import { Task } from '../../../shared/entities';

export abstract class TaskGoalQueryPort {
  abstract listByGoal(userId: number, goalId: number): Promise<Task[]>;

  abstract replaceTaskLinksForGoal(
    userId: number,
    goalId: number,
    taskIds: string[],
  ): Promise<{ taskIds: string[] }>;
}
