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
import { StoryWorkflowService } from './story-workflow.service';
import {
  dependencyIssue,
  normalizeStoryGroup,
  storyStatusId,
  storyWorkflow,
} from './domain/story-workflow';
import type {
  Project,
  StoryWorkflowStatus,
} from '../../shared/entities/project.entity';

export interface BoardGroupNode extends BoardGroup {
  children: BoardGroupNode[];
}

@Injectable()
export class BoardGroupService {
  constructor(
    private readonly groupRepo: BoardGroupRepositoryPort,
    private readonly projectRepo: ProjectRepositoryPort,
    private readonly workflow: StoryWorkflowService,
  ) {}

  private assertDates(
    type: 'epic' | 'story',
    startDate: string | null,
    dueDate: string | null,
  ): void {
    if (type === 'story' && (startDate !== null || dueDate !== null)) {
      throw new BadRequestException('Only epics have dates');
    }
    if (startDate !== null && dueDate !== null && startDate > dueDate) {
      throw new BadRequestException('startDate must not be after dueDate');
    }
  }

  private async validateProjectAccess(userId: number, projectId: string) {
    const project = await this.projectRepo.findById(projectId, userId);
    if (!project)
      throw new NotFoundException(`Project #${projectId} not found`);
    if (project.userId !== userId)
      throw new ForbiddenException('Project belongs to another user');
    return project;
  }

  async getTree(userId: number, projectId: string): Promise<BoardGroupNode[]> {
    const project = await this.validateProjectAccess(userId, projectId);
    const statuses = storyWorkflow(project);
    const groups = await this.groupRepo.findAllByProject(projectId);

    const nodeById = new Map<string, BoardGroupNode>();
    for (const group of groups) {
      nodeById.set(group.id, {
        ...normalizeStoryGroup(group, statuses),
        children: [],
      });
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
    return this.workflow.exclusive(projectId, () =>
      this.createGroup(userId, projectId, dto),
    );
  }

  private async createGroup(
    userId: number,
    projectId: string,
    dto: CreateGroupDto,
  ): Promise<BoardGroup> {
    const project = await this.validateProjectAccess(userId, projectId);

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

    const startDate = dto.startDate ?? null;
    const dueDate = dto.dueDate ?? null;
    this.assertDates(type, startDate, dueDate);

    return this.groupRepo.create({
      userId,
      projectId,
      parentId,
      type,
      title: dto.title,
      description: dto.description ?? null,
      color: dto.color ?? null,
      order: nextOrder,
      startDate,
      dueDate,
      workflowStatusId:
        type === 'story'
          ? storyStatusId(
              { workflowStatusId: null, status: 'open' },
              storyWorkflow(project),
            )
          : null,
      blockedReason: null,
      deferredUntil: null,
      archived: false,
      dependencyIds: [],
    });
  }

  async update(
    userId: number,
    projectId: string,
    id: string,
    dto: UpdateGroupDto,
  ): Promise<BoardGroup> {
    return this.workflow.exclusive(projectId, () =>
      this.updateGroup(userId, projectId, id, dto),
    );
  }

  private async updateGroup(
    userId: number,
    projectId: string,
    id: string,
    dto: UpdateGroupDto,
  ): Promise<BoardGroup> {
    const project = await this.validateProjectAccess(userId, projectId);
    const current = await this.groupRepo.findById(id, projectId);
    if (!current) throw new NotFoundException(`Group #${id} not found`);
    const group = { ...current };

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

    const finalStartDate =
      dto.startDate !== undefined ? dto.startDate : group.startDate;
    const finalDueDate =
      dto.dueDate !== undefined ? dto.dueDate : group.dueDate;
    this.assertDates(group.type, finalStartDate, finalDueDate);
    group.startDate = finalStartDate;
    group.dueDate = finalDueDate;

    if (dto.title !== undefined) {
      if (!dto.title) throw new BadRequestException('Group title is required');
      group.title = dto.title;
    }
    if (dto.description !== undefined) group.description = dto.description;
    if (dto.color !== undefined) group.color = dto.color;

    await this.applyStoryFields(group, dto, project);
    return this.groupRepo.save(
      normalizeStoryGroup(group, storyWorkflow(project)),
    );
  }

  private async applyStoryFields(
    group: BoardGroup,
    dto: UpdateGroupDto,
    project: Project,
  ): Promise<void> {
    const storyFields = [
      'workflowStatusId',
      'blockedReason',
      'deferredUntil',
      'archived',
      'dependencyIds',
    ] as const;
    if (
      group.type !== 'story' &&
      storyFields.some((field) => dto[field] !== undefined)
    ) {
      throw new BadRequestException(
        'Поля жизненного цикла доступны только историям',
      );
    }
    if (group.type === 'story') {
      this.applyStoryStatus(group, dto, storyWorkflow(project));
      if (dto.blockedReason !== undefined)
        group.blockedReason = dto.blockedReason?.trim() ?? null;
      if (dto.deferredUntil !== undefined)
        group.deferredUntil = dto.deferredUntil;
      if (dto.archived !== undefined) group.archived = dto.archived;
      if (dto.dependencyIds !== undefined) {
        const groups = await this.groupRepo.findAllByProject(project.id);
        const issue = dependencyIssue(group.id, dto.dependencyIds, groups);
        if (issue) throw new BadRequestException(issue);
        group.dependencyIds = [...dto.dependencyIds];
      }
    } else if (dto.status !== undefined) {
      group.status = dto.status;
    }
    if (dto.status !== undefined || dto.workflowStatusId !== undefined) {
      group.completedAt =
        group.status === 'done' ? (group.completedAt ?? new Date()) : null;
    }
  }

  private applyStoryStatus(
    group: BoardGroup,
    dto: UpdateGroupDto,
    statuses: StoryWorkflowStatus[],
  ): void {
    let id = storyStatusId(group, statuses);
    if (dto.status !== undefined) {
      id = storyStatusId(
        { workflowStatusId: null, status: dto.status },
        statuses,
      );
    }
    if (dto.workflowStatusId !== undefined) id = dto.workflowStatusId;
    const selected = statuses.find((status) => status.id === id);
    if (!selected)
      throw new BadRequestException(
        'Статус истории не найден в каталоге проекта',
      );
    const status = selected.category === 'done' ? 'done' : 'open';
    if (dto.status !== undefined && dto.status !== status) {
      throw new BadRequestException(
        'Статус истории противоречит признаку выполнения',
      );
    }
    group.workflowStatusId = selected.id;
    group.status = status;
  }

  async delete(userId: number, projectId: string, id: string): Promise<void> {
    return this.workflow.exclusive(projectId, () =>
      this.deleteGroup(userId, projectId, id),
    );
  }

  private async deleteGroup(
    userId: number,
    projectId: string,
    id: string,
  ): Promise<void> {
    await this.validateProjectAccess(userId, projectId);

    const groups = await this.groupRepo.findAllByProject(projectId);
    const removed = new Set([
      id,
      ...groups
        .filter((group) => group.parentId === id)
        .map((group) => group.id),
    ]);
    if (
      groups.some(
        (group) =>
          !removed.has(group.id) &&
          (group.dependencyIds ?? []).some((dependency) =>
            removed.has(dependency),
          ),
      )
    ) {
      throw new BadRequestException(
        'Сначала удалите зависимости других историй от этой группы',
      );
    }
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

    const selectedIds = new Set(orderedIds);
    if (selectedIds.size !== orderedIds.length) {
      throw new BadRequestException('Ordered IDs must be unique');
    }

    const groups = await this.groupRepo.findAllByProject(projectId);
    const groupsById = new Map(groups.map((group) => [group.id, group]));
    const selected = orderedIds.map((id) => {
      const group = groupsById.get(id);
      if (!group) {
        throw new BadRequestException('All groups must belong to this project');
      }
      return group;
    });
    const parentId = selected[0].parentId;
    if (selected.some((group) => group.parentId !== parentId)) {
      throw new BadRequestException('Only sibling groups can be reordered');
    }

    const remaining = groups.filter(
      (group) => group.parentId === parentId && !selectedIds.has(group.id),
    );
    const updates = [...selected, ...remaining].map((group, order) => ({
      id: group.id,
      order,
    }));
    await this.groupRepo.reorder(projectId, updates);
  }
}
