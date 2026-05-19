import type { GoalTypeKey } from '@/features/goals/model/use-goal-create-flow'

/**
 * Локальная копия `GOAL_TYPE_CONFIG` с бэка
 * (`alfy-bot/src/shared/constants/goal-types.ts`).
 */
export interface GoalTypeOption {
  type: GoalTypeKey
  emoji: string
  label: string
  enabled: boolean
}

export const GOAL_TYPE_OPTIONS: GoalTypeOption[] = [
  { type: 'simple', emoji: '📝', label: 'Простая цель', enabled: true },
  { type: 'smart', emoji: '🎯', label: 'SMART цель', enabled: false },
  { type: 'global', emoji: '🌍', label: 'Global цель', enabled: false },
]
