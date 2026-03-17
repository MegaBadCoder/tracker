import type { Priority } from './types'

export type { Priority }

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
}

export const PRIORITIES: Priority[] = ['high', 'medium', 'low']

export const POMODORO_DEFAULTS = {
  count: 4,
  duration: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakInterval: 4,
}
