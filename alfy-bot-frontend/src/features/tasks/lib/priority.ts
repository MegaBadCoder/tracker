import type { Priority } from '../model/types'

const PRIORITY_COLORS: Record<Priority, string> = {
  high: 'border-l-4 border-l-red-500',
  medium: 'border-l-4 border-l-yellow-500',
  low: 'border-l-4 border-l-green-500',
}

const PRIORITY_ICON_COLORS: Record<Priority, string> = {
  high: 'text-red-500',
  medium: 'text-yellow-500',
  low: 'text-green-500',
}

export const getPriorityClasses = (priority?: Priority): string => {
  if (!priority) return ''
  return PRIORITY_COLORS[priority]
}

export const getPriorityColor = (priority: Priority): string => {
  return PRIORITY_ICON_COLORS[priority]
}
