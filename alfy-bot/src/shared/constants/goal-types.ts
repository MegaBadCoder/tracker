export const GOAL_TYPES = {
  SIMPLE: 'simple',
  SMART: 'smart',
  GLOBAL: 'global',
} as const;

export type GoalType = (typeof GOAL_TYPES)[keyof typeof GOAL_TYPES];

export const GOAL_TYPE_CONFIG = {
  [GOAL_TYPES.SIMPLE]: {
    emoji: '📝',
    label: 'Простая цель',
    enabled: true,
  },
  [GOAL_TYPES.SMART]: {
    emoji: '🎯',
    label: 'SMART цель',
    enabled: false,
  },
  [GOAL_TYPES.GLOBAL]: {
    emoji: '🌍',
    label: 'Global цель',
    enabled: false,
  },
} as const;
