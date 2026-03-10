import type { Priority } from '../model/constants'

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
}

export interface TaskCardEmits {
  (e: 'toggle', id: string): void
  (e: 'showTimer', id: string): void
  (e: 'delete', id: string): void
}
