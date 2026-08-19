import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { BoardGroup } from '../../shared/entities';
import { BoardGroupRepositoryPort } from './domain/board-group-repository.port';
import { ProjectRepositoryPort } from './domain/project-repository.port';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

export interface BoardGroupNode extends BoardGroup {
  children: BoardGroupNode[];
}

@Injectable()
export class BoardGroupService {
  constructor(
    private readonly groupRepo: BoardGroupRepositoryPort,
    private readonly projectRepo: ProjectRepositoryPort,
  ) {}

  private async validateProjectAccess(userId: number, projectId: string) {
    const project = await this.projectRepo.findById(projectId, userId);
    if (!project)
      throw new NotFoundException(`Project #${projectId} not found`);
    if (project.userId !== userId)
      throw new ForbiddenException('Project belongs to another user');
    return project;
  }

  async getTree(userId: number, projectId: string): Promise<BoardGroupNode[]> {
    await this.validateProjectAccess(userId, projectId);
    const groups = await this.groupRepo.findAllByProject(projectId);

    const nodeById = new Map<string, BoardGroupNode>();
    for (const group of groups) {
      nodeById.set(group.id, { ...group, children: [] });
    }

    const roots: BoardGroupNode[] = [];
    for (const group of groups) {
      const node = nodeById.get(group.id) as BoardGroupNode;
      if (group.parentId) {
        const parent = nodeById.get(group.parentId);
        if (parent) parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async create(
    userId: number,
    projectId: string,
    dto: CreateGroupDto,
  ): Promise<BoardGroup> {
    await this.validateProjectAccess(userId, projectId);

    let type: 'epic' | 'story' = 'epic';
    let parentId: string | null = null;

    if (dto.parentId) {
      const parent = await this.groupRepo.findById(dto.parentId, projectId);
      if (!parent || parent.parentId !== null) {
        throw new BadRequestException(
          'Parent must be a top-level epic in this project',
        );
      }
      type = 'story';
      parentId = dto.parentId;
    }

    const existing = await this.groupRepo.findAllByProject(projectId);
    const siblings = existing.filter((g) => g.parentId === parentId);
    const nextOrder = siblings.length;

    return this.groupRepo.create({
      userId,
      projectId,
      parentId,
      type,
      title: dto.title,
      description: dto.description ?? null,
      color: dto.color ?? null,
      order: nextOrder,
    });
  }

  async update(
    userId: number,
    projectId: string,
    id: string,
    dto: UpdateGroupDto,
  ): Promise<BoardGroup> {
    await this.validateProjectAccess(userId, projectId);

    const group = await this.groupRepo.findById(id, projectId);
    if (!group) throw new NotFoundException(`Group #${id} not found`);

    if (dto.parentId !== undefined && dto.parentId !== group.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('Group cannot be its own parent');
      }

      const childCount = await this.groupRepo.countChildren(id);
      if (childCount > 0) {
        throw new BadRequestException(
          'Cannot reparent a group that has children',
        );
      }

      const parent = await this.groupRepo.findById(dto.parentId, projectId);
      if (!parent || parent.parentId !== null) {
        throw new BadRequestException(
          'Parent must be a top-level epic in this project',
        );
      }

      group.parentId = dto.parentId;
      group.type = 'story';
    }

    if (dto.title !== undefined) group.title = dto.title;
    if (dto.description !== undefined) group.description = dto.description;
    if (dto.color !== undefined) group.color = dto.color;

    if (dto.status !== undefined) {
      group.status = dto.status;
      group.completedAt = dto.status === 'done' ? new Date() : null;
    }

    return this.groupRepo.save(group);
  }

  async delete(userId: number, projectId: string, id: string): Promise<void> {
    await this.validateProjectAccess(userId, projectId);

    const deleted = await this.groupRepo.delete(id, projectId);
    if (!deleted) throw new NotFoundException(`Group #${id} not found`);
  }

  async reorder(
    userId: number,
    projectId: string,
    orderedIds: string[],
  ): Promise<void> {
    await this.validateProjectAccess(userId, projectId);

    if (orderedIds.length === 0) {
      throw new BadRequestException('Ordered IDs array cannot be empty');
    }

    const updates = orderedIds.map((id, index) => ({ id, order: index }));
    await this.groupRepo.reorder(updates);
  }
}
