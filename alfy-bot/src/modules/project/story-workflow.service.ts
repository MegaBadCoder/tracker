import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRepositoryPort } from './domain/project-repository.port';
import { BoardGroupRepositoryPort } from './domain/board-group-repository.port';
import {
  storyWorkflow,
  workflowIssue,
  type StoryWorkflowStatus,
} from './domain/story-workflow';

@Injectable()
export class StoryWorkflowService {
  private readonly pending = new Map<string, Promise<unknown>>();

  constructor(
    private readonly projectRepo: ProjectRepositoryPort,
    private readonly groupRepo: BoardGroupRepositoryPort,
  ) {}

  /** Возвращает каталог доступного пользователю agile-проекта без изменения базы. */
  async get(
    userId: number,
    projectId: string,
  ): Promise<{ statuses: StoryWorkflowStatus[] }> {
    const project = await this.projectRepo.findById(projectId, userId);
    if (!project || project.userId !== userId)
      throw new NotFoundException('Проект не найден');
    if (project.type !== 'agile')
      throw new BadRequestException('Статусы историй доступны в agile-проекте');
    return { statuses: storyWorkflow(project) };
  }

  /** Сохраняет каталог; занятые статусы нельзя удалять или переводить в другую категорию. */
  async replace(
    userId: number,
    projectId: string,
    statuses: StoryWorkflowStatus[],
  ): Promise<{ statuses: StoryWorkflowStatus[] }> {
    return this.exclusive(projectId, async () => {
      const previous = await this.get(userId, projectId);
      const groups = await this.groupRepo.findAllByProject(projectId);
      const issue = workflowIssue(statuses, previous.statuses, groups);
      if (issue) throw new BadRequestException(issue);
      const project = await this.projectRepo.update(userId, projectId, {
        storyWorkflow: statuses.map((status) => ({
          ...status,
          name: status.name.trim(),
        })),
      });
      return { statuses: storyWorkflow(project) };
    });
  }

  /** Последовательно выполняет операции каталога и историй одного проекта; ошибка не блокирует следующие операции. */
  async exclusive<T>(
    projectId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.pending.get(projectId) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    this.pending.set(projectId, current);
    try {
      return await current;
    } finally {
      if (this.pending.get(projectId) === current)
        this.pending.delete(projectId);
    }
  }
}
