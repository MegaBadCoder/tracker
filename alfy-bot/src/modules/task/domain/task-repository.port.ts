import { Task, PomodoroConfig } from '../../../shared/entities';
import type { ChecklistItem, ChecklistData } from '../../../shared/types/checklist.types';

// Re-export for backward compatibility
export type { ChecklistItem, ChecklistData };

export abstract class TaskRepositoryPort {
  abstract findAllByUser(userId: number): Promise<Task[]>;
  abstract findById(id: string, userId: number): Promise<Task | null>;
  abstract create(task: Partial<Task>): Promise<Task>;
  abstract save(task: Task): Promise<Task>;
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
  abstract updatePomodoroConfig(
    task: Task,
    data: Partial<PomodoroConfig> | null,
  ): Promise<Task>;
  abstract findAllByProject(
    userId: number,
    projectId: string | null,
  ): Promise<Task[]>;
  abstract updatePosition(
    taskId: string,
    userId: number,
    projectId: string | null,
    columnId: string | null,
    order: number,
  ): Promise<Task | null>;
  abstract reorderTasks(
    updates: { id: string; order: number }[],
  ): Promise<void>;
  abstract findByParentId(
    parentId: string,
    onlyUncompleted: boolean,
  ): Promise<Task[]>;
  abstract deleteByParentId(
    parentId: string,
    onlyUncompleted: boolean,
  ): Promise<void>;
  abstract clearParentId(parentId: string): Promise<void>;
}
