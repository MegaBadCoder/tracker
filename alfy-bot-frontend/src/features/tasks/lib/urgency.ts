export type DueDateUrgency = 'overdue' | 'soon' | 'normal' | 'none'

export const getDueDateUrgency = (date?: Date): DueDateUrgency => {
  if (!date) return 'none'
  const days = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (days < 0) return 'overdue'
  if (days <= 3) return 'soon'
  return 'normal'
}
