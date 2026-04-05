import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ProjectRepositoryPort } from './domain/project-repository.port';
import { ProjectColumnRepositoryPort } from './domain/project-column-repository.port';
import { TaskRepositoryPort } from '../task/domain/task-repository.port';
import { MoveTaskDto } from './dto/move-task.dto';
import { ReorderTasksDto } from './dto/reorder-tasks.dto';

@Injectable()
export class ProjectTaskService {
  constructor(
    private readonly projectRepo: ProjectRepositoryPort,
    private readonly columnRepo: ProjectColumnRepositoryPort,
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
    const currentProject = await this.projectRepo.findById(currentProjectId, userId);
    if (!currentProject) throw new NotFoundException(`Project #${currentProjectId} not found`);
    if (currentProject.userId !== userId) throw new ForbiddenException('Project belongs to another user');

    // Validate task
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new NotFoundException(`Task #${taskId} not found`);

    const targetProjectId = dto.projectId !== undefined ? dto.projectId : currentProjectId;
    const targetColumnId = dto.columnId !== undefined ? dto.columnId : null;

    // Cannot set column without project
    if (targetColumnId && !targetProjectId) {
      throw new BadRequestException('Cannot assign column without a project');
    }

    // Validate target project if moving to a different project
    if (targetProjectId && targetProjectId !== currentProjectId) {
      const targetProject = await this.projectRepo.findById(targetProjectId, userId);
      if (!targetProject) throw new NotFoundException(`Target project #${targetProjectId} not found`);
      if (targetProject.userId !== userId) throw new ForbiddenException('Target project belongs to another user');

      if (targetColumnId && targetProject.viewMode === 'list') {
        throw new BadRequestException('Cannot assign column in a list-mode project');
      }
    } else if (targetProjectId && targetColumnId) {
      // Same project — validate viewMode
      if (currentProject.viewMode === 'list') {
        throw new BadRequestException('Cannot assign column in a list-mode project');
      }
    }

    // Validate column
    if (targetColumnId && targetProjectId) {
      const column = await this.columnRepo.findById(targetColumnId, targetProjectId);
      if (!column) throw new NotFoundException(`Column #${targetColumnId} not found`);
    }

    return this.taskRepo.updatePosition(
      taskId,
      userId,
      targetProjectId,
      targetColumnId,
      order,
    );
  }

  async reorderTasks(
    userId: number,
    projectId: string,
    dto: ReorderTasksDto,
  ) {
    if (dto.orderedIds.length === 0) {
      throw new BadRequestException('Ordered IDs array cannot be empty');
    }

    const project = await this.projectRepo.findById(projectId, userId);
    if (!project) throw new NotFoundException(`Project #${projectId} not found`);
    if (project.userId !== userId) throw new ForbiddenException('Project belongs to another user');

    const updates = dto.orderedIds.map((id, index) => ({ id, order: index }));
    await this.taskRepo.reorderTasks(updates);
  }
}
