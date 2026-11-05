import type { TaskDependencyEdge } from './task-dependency';

export interface DependencyTask {
  id: string;
  isOverdue: boolean;
}

export interface TaskDependencyTransaction {
  findTasks(userId: number, ids: string[]): Promise<DependencyTask[]>;
  graph(userId: number): Promise<TaskDependencyEdge[]>;
  replace(taskId: string, dependencyIds: string[]): Promise<void>;
}

export abstract class TaskDependencyPort {
  abstract graph(userId: number): Promise<TaskDependencyEdge[]>;
  /** Проверяет и сохраняет связи одной атомарной операцией в общей очереди SQLite. */
  abstract transaction<T>(
    work: (transaction: TaskDependencyTransaction) => Promise<T>,
  ): Promise<T>;
}
