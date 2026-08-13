import { isSameDay, startOfDay } from 'date-fns'
import type { Task } from '@/features/tasks/model/types'
import type { CalendarEvent } from '../model/types'
import { computeTaskDurationMinutes } from '@/features/tasks/lib/duration'
import {
  computeNextDueDate,
  findNextOccurrenceOnOrAfter,
  seriesDueDate,
} from '@/features/tasks/model/recurrence'

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
    resizable: !isVirtual && !task.isPomodoroTask && hasTime,
    pomodoroLabel: task.isPomodoroTask
      ? `${task.pomodoroCount ?? 4}x${task.pomodoroDuration ?? 25} мин`
      : undefined,
  }
}

function familyId(task: Task): string {
  return task.recurringParentId ?? task.id
}

function isLiveCursor(task: Task): boolean {
  return !task.completed && !task.isOverdue
}

function occupiedSlotKeys(members: Task[]): Set<number> {
  const keys = new Set<number>()
  for (const member of members) {
    const slot = seriesDueDate(member)
    if (slot) keys.add(startOfDay(slot).getTime())
    if (member.dueDate) keys.add(startOfDay(new Date(member.dueDate)).getTime())
  }
  return keys
}

function emitGhosts(
  root: Task,
  occupied: Set<number>,
  weekStart: Date,
  weekEnd: Date,
  events: CalendarEvent[],
) {
  if (!root.recurrence) return
  const seriesDue = seriesDueDate(root)
  if (!seriesDue) return

  const completedCount = root.recurringCompletedCount ?? 0

  const maybeEmit = (date: Date) => {
    if (date < weekStart || date > weekEnd) return
    if (occupied.has(startOfDay(date).getTime())) return
    events.push(taskToEvent(root, date, true))
  }

  let current = seriesDue
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  if (seriesDue < startOfToday) {
    const skipped = findNextOccurrenceOnOrAfter(
      seriesDue,
      root.recurrence,
      startOfToday,
      completedCount,
    )
    if (!skipped) return
    current = skipped
    maybeEmit(skipped)
  }

  for (let i = 0; i < 52; i++) {
    const next = computeNextDueDate(current, root.recurrence, completedCount)
    if (!next) break
    if (next > weekEnd) break
    if (next >= weekStart) maybeEmit(next)
    current = next
  }
}

export function tasksToCalendarEvents(tasks: Task[], weekStart: Date, weekEnd: Date): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const families = new Map<string, Task[]>()

  for (const task of tasks) {
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate)
      if (dueDate >= weekStart && dueDate <= weekEnd) {
        events.push(taskToEvent(task, dueDate))
      }
    }

    if (task.recurrence || task.recurringParentId) {
      const id = familyId(task)
      const members = families.get(id)
      if (members) members.push(task)
      else families.set(id, [task])
    }
  }

  for (const [, members] of families) {
    const live = members.filter(isLiveCursor)
    const source =
      live.find(t => !t.recurringParentId)
      ?? live.find(t => t.isAutoCreated)
      ?? live[0]
    if (!source?.recurrence) continue
    emitGhosts(source, occupiedSlotKeys(members), weekStart, weekEnd, events)
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
