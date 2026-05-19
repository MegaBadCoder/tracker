export const GOAL_STATUSES = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
  DELETED: 'deleted',
} as const;

export type GoalStatus = (typeof GOAL_STATUSES)[keyof typeof GOAL_STATUSES];

export const GOAL_STATUS_LABELS = {
  [GOAL_STATUSES.ACTIVE]: 'Активные',
  [GOAL_STATUSES.COMPLETED]: 'Достигнутые',
  [GOAL_STATUSES.ARCHIVED]: 'В архиве',
  [GOAL_STATUSES.DELETED]: 'Удалённые',
} as const;
