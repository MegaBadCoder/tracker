import type { ChecklistItem } from '../model/types'

export function createChecklistItem(text: string, items: ChecklistItem[]): ChecklistItem {
  const maxOrder = items.reduce((max, i) => Math.max(max, i.order), -1)
  return {
    id: crypto.randomUUID(),
    text,
    completed: false,
    order: maxOrder + 1,
  }
}

export function computeChecklistProgress(items: ChecklistItem[]) {
  const total = items.length
  const completed = items.filter(i => i.completed).length
  const progress = total === 0 ? 0 : (completed / total) * 100
  return { total, completed, progress }
}
