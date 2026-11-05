import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TaskDependencyPort } from './domain/task-dependency.port';
import { createsDependencyCycle } from './domain/task-dependency';

@Injectable()
export class TaskDependencyService {
  constructor(private readonly repository: TaskDependencyPort) {}

  graph(userId: number) {
    return this.repository.graph(userId);
  }

  async replace(userId: number, taskId: string, dependencyIds: string[]) {
    if (
      dependencyIds.includes(taskId) ||
      new Set(dependencyIds).size !== dependencyIds.length
    ) {
      throw new BadRequestException(
        'Предшественники не могут повторяться или включать саму задачу',
      );
    }
    return this.repository.transaction(async (transaction) => {
      const tasks = await transaction.findTasks(userId, [
        taskId,
        ...dependencyIds,
      ]);
      const task = tasks.find((candidate) => candidate.id === taskId);
      if (!task || tasks.length !== dependencyIds.length + 1) {
        throw new NotFoundException('Задача или предшественник не найдены');
      }
      if (task.isOverdue) {
        throw new BadRequestException('Замороженную задачу нельзя изменять');
      }
      const edges = await transaction.graph(userId);
      if (createsDependencyCycle(taskId, dependencyIds, edges)) {
        throw new BadRequestException('Зависимости образуют цикл');
      }
      const canonicalIds = [...dependencyIds].sort();
      await transaction.replace(taskId, canonicalIds);
      return { taskId, dependencyIds: canonicalIds };
    });
  }
}
