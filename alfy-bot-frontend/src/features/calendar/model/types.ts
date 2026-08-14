import type { Priority, Task } from '@/features/tasks/model/types'

export interface CalendarEvent {
  taskId: string
  title: string
  date: Date
  startMinutes: number
  durationMinutes: number
  isAllDay: boolean
  task: Task
  priority?: Priority
  completed: boolean
  isRecurring?: boolean
  isVirtual?: boolean
  resizable: boolean
  pomodoroLabel?: string
}

export type CalendarViewMode = 'week' | 'day'

export interface CalendarDropPayload {
  taskId: string
  newDate: Date
  startMinutes?: number
  isVirtual?: boolean
}
