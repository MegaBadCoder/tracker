import type { RecurrenceRule } from './recurrence'

export type Priority = 'high' | 'medium' | 'low'

export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  order: number
}

export interface Checklist {
  items: ChecklistItem[]
}

export interface Task {
  id: string
  title: string
  completed: boolean
  dueDate?: Date
  deadline?: Date
  durationMinutes?: number
  priority?: Priority
  location?: string
  tags?: string[]
  description?: string
  isPomodoroTask?: boolean
  pomodoroCompleted?: number
  pomodoroCount?: number
  pomodoroDuration?: number
  shortBreak?: number
  longBreak?: number
  longBreakInterval?: number
  checklist?: Checklist
  recurrence?: RecurrenceRule | null
  recurringParentId?: string | null
  recurringCompletedCount?: number
  isAutoCreated?: boolean
  projectId?: string | null
  columnId?: string | null
  order?: number
  parentId?: string
  subtasks?: Task[]
  checklistProgress?: {
    total: number
    completed: number
    progress: number
  }
}

export interface TaskCardProps {
  task: Task
  projectName?: string
  variant?: 'default' | 'compact'
}

export interface TaskCardEmits {
  (e: 'toggle', id: string): void
  (e: 'showTimer', id: string): void
  (e: 'delete', id: string): void
  (e: 'open', task: Task): void
}
