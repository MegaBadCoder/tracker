import { Task } from '../../../shared/entities';

export abstract class TaskRepositoryPort {
  abstract findAllByUser(userId: number): Promise<Task[]>;
  abstract findById(id: string, userId: number): Promise<Task | null>;
  abstract create(task: Partial<Task>): Promise<Task>;
  abstract update(
    id: string,
    userId: number,
    data: Partial<Task>,
  ): Promise<Task>;
  abstract delete(id: string, userId: number): Promise<void>;
  abstract incrementPomodoroCompleted(
    taskId: string,
    increment: number,
  ): Promise<void>;
}
