import type { Task, Priority } from '@/features/tasks/model/types'

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
}

export interface CalendarDropPayload {
  taskId: string
  newDate: Date
  startMinutes?: number
}
