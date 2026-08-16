export const LINK_KIND_GOAL = 'goal';

export abstract class TaskLinkPort {
  abstract findGoalIdsByTaskIds(
    userId: number,
    taskIds: string[],
  ): Promise<Map<string, number[]>>;

  abstract replaceGoalLinks(
    userId: number,
    taskId: string,
    goalIds: number[],
  ): Promise<void>;

  abstract findTaskIdsByGoal(
    userId: number,
    goalId: number,
  ): Promise<string[]>;

  abstract replaceTaskLinksForGoal(
    userId: number,
    goalId: number,
    taskIds: string[],
  ): Promise<void>;

  abstract filterOwnedGoalIds(
    userId: number,
    goalIds: number[],
  ): Promise<number[]>;

  abstract copyGoalLinks(
    userId: number,
    fromTaskId: string,
    toTaskId: string,
  ): Promise<void>;
}
