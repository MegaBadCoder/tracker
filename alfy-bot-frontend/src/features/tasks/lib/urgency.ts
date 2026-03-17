export type DueDateUrgency = 'overdue' | 'soon' | 'normal' | 'none'

export const getDueDateUrgency = (date?: Date): DueDateUrgency => {
  if (!date) return 'none'
  const days = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (days < 0) return 'overdue'
  if (days <= 3) return 'soon'
  return 'normal'
}

export const URGENCY_CLASSES: Record<DueDateUrgency, string> = {
  overdue: 'text-red-500',
  soon: 'text-yellow-600 dark:text-yellow-500',
  normal: '',
  none: '',
}
