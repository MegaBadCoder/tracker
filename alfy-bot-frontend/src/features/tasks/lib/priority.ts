import { PRIORITY_COLORS, PRIORITY_ICON_COLORS, type Priority } from '../model/constants'

export const getPriorityClasses = (priority?: Priority): string => {
  if (!priority) return ''
  return PRIORITY_COLORS[priority]
}

export const getPriorityColor = (priority: Priority): string => {
  return PRIORITY_ICON_COLORS[priority]
}
