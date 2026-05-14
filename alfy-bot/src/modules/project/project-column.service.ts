import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ProjectColumn } from '../../shared/entities';
import { ProjectColumnRepositoryPort } from './domain/project-column-repository.port';
import { ProjectRepositoryPort } from './domain/project-repository.port';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';

@Injectable()
export class ProjectColumnService {
  constructor(
    private readonly columnRepo: ProjectColumnRepositoryPort,
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

  async getAllByProject(
    userId: number,
    projectId: string,
  ): Promise<ProjectColumn[]> {
    await this.validateProjectAccess(userId, projectId);
    return this.columnRepo.findAllByProject(projectId);
  }

  async create(
    userId: number,
    projectId: string,
    dto: CreateColumnDto,
  ): Promise<ProjectColumn> {
    const project = await this.validateProjectAccess(userId, projectId);

    if (project.viewMode === 'list') {
      throw new BadRequestException(
        'Cannot add columns to a list-mode project',
      );
    }

    const existing = await this.columnRepo.findAllByProject(projectId);
    const nextOrder = existing.length;

    return this.columnRepo.create({
      projectId,
      title: dto.title,
      color: dto.color,
      order: nextOrder,
    });
  }

  async update(
    userId: number,
    projectId: string,
    id: string,
    dto: UpdateColumnDto,
  ): Promise<ProjectColumn> {
    await this.validateProjectAccess(userId, projectId);

    const column = await this.columnRepo.findById(id, projectId);
    if (!column) throw new NotFoundException(`Column #${id} not found`);

    Object.assign(column, dto);
    return this.columnRepo.save(column);
  }

  async delete(userId: number, projectId: string, id: string): Promise<void> {
    await this.validateProjectAccess(userId, projectId);

    const deleted = await this.columnRepo.delete(id, projectId);
    if (!deleted) throw new NotFoundException(`Column #${id} not found`);
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
    await this.columnRepo.reorder(updates);
  }
}
