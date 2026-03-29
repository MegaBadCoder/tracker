import { isSameDay } from 'date-fns'
import type { Task } from '@/features/tasks/model/types'
import type { CalendarEvent } from '../model/types'
import { computeTaskDurationMinutes } from '@/features/tasks/lib/duration'

export function tasksToCalendarEvents(tasks: Task[], weekStart: Date, weekEnd: Date): CalendarEvent[] {
  const events: CalendarEvent[] = []

  for (const task of tasks) {
    if (!task.dueDate) continue

    const dueDate = new Date(task.dueDate)
    if (dueDate < weekStart || dueDate > weekEnd) continue

    const hours = dueDate.getHours()
    const minutes = dueDate.getMinutes()
    const hasTime = hours !== 0 || minutes !== 0

    events.push({
      taskId: task.id,
      title: task.title,
      date: dueDate,
      startMinutes: hasTime ? hours * 60 + minutes : 0,
      durationMinutes: hasTime ? computeTaskDurationMinutes(task) : 0,
      isAllDay: !hasTime,
      task,
      priority: task.priority,
      completed: task.completed,
    })
  }

  return events
}

export function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter(e => isSameDay(e.date, day))
}

export function getAllDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter(e => e.isAllDay)
}

export function getTimedEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter(e => !e.isAllDay)
}
