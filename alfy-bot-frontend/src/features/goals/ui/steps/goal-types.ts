import type { GoalTypeKey } from '@/features/goals/model/use-goal-create-flow'

/**
 * Локальная копия `GOAL_TYPE_CONFIG` с бэка
 * (`alfy-bot/src/shared/constants/goal-types.ts`). Без декоративных эмодзи.
 */
export interface GoalTypeOption {
  type: GoalTypeKey
  label: string
  enabled: boolean
}

export const GOAL_TYPE_OPTIONS: GoalTypeOption[] = [
  { type: 'simple', label: 'Простая цель', enabled: true },
  { type: 'smart', label: 'SMART цель', enabled: false },
  { type: 'global', label: 'Global цель', enabled: true },
]
