import { isSameDay } from 'date-fns'
import type { Task } from '@/features/tasks/model/types'
import type { CalendarEvent } from '../model/types'
import { computeTaskDurationMinutes } from '@/features/tasks/lib/duration'
import { computeNextDueDate } from '@/features/tasks/model/recurrence'

function taskToEvent(task: Task, date: Date, isVirtual = false): CalendarEvent {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const hasTime = hours !== 0 || minutes !== 0

  return {
    taskId: isVirtual ? `${task.id}__virtual__${date.getTime()}` : task.id,
    title: task.title,
    date,
    startMinutes: hasTime ? hours * 60 + minutes : 0,
    durationMinutes: hasTime ? computeTaskDurationMinutes(task) : 0,
    isAllDay: !hasTime,
    task,
    priority: task.priority,
    completed: isVirtual ? false : task.completed,
    isRecurring: !!task.recurrence,
    isVirtual,
  }
}

export function tasksToCalendarEvents(tasks: Task[], weekStart: Date, weekEnd: Date): CalendarEvent[] {
  const events: CalendarEvent[] = []

  for (const task of tasks) {
    if (!task.dueDate) continue

    const dueDate = new Date(task.dueDate)
    const isRecurring = !!task.recurrence

    // Add the real event if it falls in range
    if (dueDate >= weekStart && dueDate <= weekEnd) {
      events.push(taskToEvent(task, dueDate))
    }

    // Generate virtual future occurrences for uncompleted recurring tasks
    if (isRecurring && !task.completed && task.recurrence) {
      let current = dueDate
      const completedCount = task.recurringCompletedCount ?? 0

      for (let i = 0; i < 52; i++) {
        const next = computeNextDueDate(current, task.recurrence, completedCount)
        if (!next) break
        if (next > weekEnd) break

        if (next >= weekStart && !isSameDay(next, dueDate)) {
          events.push(taskToEvent(task, next, true))
        }

        current = next
      }
    }
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
