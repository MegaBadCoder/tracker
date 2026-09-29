import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ProjectRepositoryPort } from './domain/project-repository.port';
import { ProjectColumnRepositoryPort } from './domain/project-column-repository.port';
import { BoardGroupRepositoryPort } from './domain/board-group-repository.port';
import { TaskRepositoryPort } from '../task/domain/task-repository.port';
import { MoveTaskDto } from './dto/move-task.dto';
import { ReorderTasksDto } from './dto/reorder-tasks.dto';

@Injectable()
export class ProjectTaskService {
  constructor(
    private readonly projectRepo: ProjectRepositoryPort,
    private readonly columnRepo: ProjectColumnRepositoryPort,
    private readonly groupRepo: BoardGroupRepositoryPort,
    private readonly taskRepo: TaskRepositoryPort,
  ) {}

  async moveTask(
    userId: number,
    currentProjectId: string,
    taskId: string,
    dto: MoveTaskDto,
  ) {
    const order = dto.order ?? 0;

    if (order < 0) {
      throw new BadRequestException('Order cannot be negative');
    }

    // Validate current project access
    const currentProject = await this.projectRepo.findById(
      currentProjectId,
      userId,
    );
    if (!currentProject)
      throw new NotFoundException(`Project #${currentProjectId} not found`);
    if (currentProject.userId !== userId)
      throw new ForbiddenException('Project belongs to another user');

    // Validate task
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new NotFoundException(`Task #${taskId} not found`);

    const targetProjectId =
      dto.projectId !== undefined ? dto.projectId : currentProjectId;
    const targetColumnId = dto.columnId !== undefined ? dto.columnId : null;
    // Асимметрия с columnId намеренная. Обычная board-доска шлёт move без
    // groupId, и трактовка "не пришло значит обнулить" стирала бы эпик у
    // задачи после одного перетаскивания в режиме board — то есть настройка
    // отображения выполняла бы необратимое доменное действие. Отсутствие
    // поля значит "не трогать", явный null значит "убрать из группы".
    // Исключение — переезд в другой проект: группа принадлежит старому
    // проекту, тащить её за собой нельзя.
    const keepsProject = targetProjectId === task.projectId;
    const targetGroupId =
      dto.groupId !== undefined
        ? dto.groupId
        : keepsProject
          ? task.groupId
          : null;
    const targetSprintId = keepsProject ? task.sprintId : null;

    // Cannot set column without project
    if (targetColumnId && !targetProjectId) {
      throw new BadRequestException('Cannot assign column without a project');
    }

    // Validate target project if moving to a different project
    let targetProject = currentProject;
    if (targetProjectId && targetProjectId !== currentProjectId) {
      const found = await this.projectRepo.findById(targetProjectId, userId);
      if (!found)
        throw new NotFoundException(
          `Target project #${targetProjectId} not found`,
        );
      if (found.userId !== userId)
        throw new ForbiddenException('Target project belongs to another user');
      targetProject = found;
    }

    if (targetColumnId && targetProjectId) {
      if (
        targetProject.type === 'simple' &&
        targetProject.viewMode === 'list'
      ) {
        throw new BadRequestException(
          'Cannot assign column in a list-mode project',
        );
      }
    }

    // Drop в сайдбаре кладёт в URL проект назначения,
    // поэтому источник переноса — task.projectId.
    if (!keepsProject && task.projectId) {
      const originProject =
        task.projectId === currentProjectId
          ? currentProject
          : task.projectId === targetProjectId
            ? targetProject
            : await this.projectRepo.findById(task.projectId, userId);

      if (
        originProject?.type === 'agile' &&
        (!targetProjectId || targetProject.type !== 'agile')
      ) {
        throw new BadRequestException(
          targetProjectId
            ? 'Cannot move a task out of an agile project'
            : 'Cannot move a task from an agile project to the inbox',
        );
      }
    }

    // Validate column
    if (targetColumnId && targetProjectId) {
      const column = await this.columnRepo.findById(
        targetColumnId,
        targetProjectId,
      );
      if (!column)
        throw new NotFoundException(`Column #${targetColumnId} not found`);
    }

    // Validate group
    if (targetGroupId && targetProjectId) {
      const group = await this.groupRepo.findById(
        targetGroupId,
        targetProjectId,
      );
      if (!group)
        throw new NotFoundException(`Group #${targetGroupId} not found`);
    }

    const columnId =
      targetSprintId && !targetColumnId && targetProjectId
        ? await this.firstColumnId(targetProjectId)
        : targetColumnId;

    return this.taskRepo.updatePosition(
      taskId,
      userId,
      targetProjectId,
      columnId,
      targetGroupId,
      targetSprintId,
      order,
    );
  }

  async reorderTasks(userId: number, projectId: string, dto: ReorderTasksDto) {
    if (dto.orderedIds.length === 0) {
      throw new BadRequestException('Ordered IDs array cannot be empty');
    }

    const project = await this.projectRepo.findById(projectId, userId);
    if (!project)
      throw new NotFoundException(`Project #${projectId} not found`);
    if (project.userId !== userId)
      throw new ForbiddenException('Project belongs to another user');

    const updates = dto.orderedIds.map((id, index) => ({ id, order: index }));
    await this.taskRepo.reorderTasks(updates);
  }

  private async firstColumnId(projectId: string): Promise<string | null> {
    const columns = await this.columnRepo.findAllByProject(projectId);
    if (columns.length === 0) return null;
    return columns.reduce((min, c) => (c.order < min.order ? c : min)).id;
  }
}
