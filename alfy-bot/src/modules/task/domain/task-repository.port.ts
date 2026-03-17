import { Task } from '../../../shared/entities';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  order: number;
}

export interface ChecklistData {
  items: ChecklistItem[];
}

export abstract class TaskRepositoryPort {
  abstract findAllByUser(userId: number): Promise<Task[]>;
  abstract findById(id: string, userId: number): Promise<Task | null>;
  abstract create(task: Partial<Task>): Promise<Task>;
  abstract update(
    id: string,
    userId: number,
    data: Partial<Task>,
  ): Promise<Task | null>;
  abstract delete(id: string, userId: number): Promise<boolean>;
  abstract incrementPomodoroCompleted(
    taskId: string,
    increment: number,
  ): Promise<void>;
  abstract updateChecklist(
    task: Task,
    data: ChecklistData,
  ): Promise<Task>;
}
