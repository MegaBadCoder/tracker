import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { tasksToCalendarEvents } from './calendar-events'
import type { Task } from '@/features/tasks/model/types'
import type { RecurrenceRule } from '@/features/tasks/model/recurrence'

// Local-time constructor — frontend calendar projections operate on local time
// per project TZ conventions, so all dates are constructed locally to remain
// deterministic regardless of the runner's IANA timezone.
const local = (
  y: number,
  m: number,
  d: number,
  h = 0,
  min = 0,
) => new Date(y, m - 1, d, h, min, 0, 0)

const dailyRule: RecurrenceRule = { frequency: 'daily', interval: 1 }
const weeklyMonRule: RecurrenceRule = {
  frequency: 'weekly',
  interval: 1,
  daysOfWeek: [1],
}

const baseTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Test',
  completed: false,
  ...overrides,
})

describe('tasksToCalendarEvents — past-due recurring skip-to-today', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Mock "today" to April 29 2026 at 13:00 local.
    vi.setSystemTime(local(2026, 4, 29, 13, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('past-due daily task: ghosts only emitted on today and future, not on intermediate past days', () => {
    const task = baseTask({
      id: 'past-daily',
      dueDate: local(2026, 4, 20, 10, 0),
      recurrence: dailyRule,
    })
    const weekStart = local(2026, 4, 26, 0, 0)
    const weekEnd = local(2026, 5, 2, 23, 59)

    const events = tasksToCalendarEvents([task], weekStart, weekEnd)
    const taskEvents = events.filter(e => e.taskId.includes(task.id))

    // No real event (dueDate is before weekStart), only ghosts from today onwards.
    const ghosts = taskEvents.filter(e => e.isVirtual)
    expect(taskEvents.length).toBe(4)
    expect(ghosts.length).toBe(4)

    const startOfToday = local(2026, 4, 29, 0, 0)
    for (const ev of ghosts) {
      expect(ev.date.getTime()).toBeGreaterThanOrEqual(startOfToday.getTime())
    }

    // Specifically: ghosts on April 29, 30, May 1, May 2.
    const ghostDays = ghosts.map(e => e.date.getDate()).sort((a, b) => a - b)
    expect(ghostDays).toEqual([1, 2, 29, 30])
  })

  it('past-due weekly Mon task: next Mon falls outside window after skip-to-today, no ghosts', () => {
    // dueDate April 13 (Mon). weekly Mon steps: April 20, April 27, May 4.
    // Skip-to-today (April 29) -> first Mon >= April 29 is May 4 (April 27 is < today).
    // May 4 > weekEnd (May 2) -> no ghost emitted in the [April 26, May 2] window.
    const task = baseTask({
      id: 'past-weekly',
      dueDate: local(2026, 4, 13, 10, 0),
      recurrence: weeklyMonRule,
    })
    const weekStart = local(2026, 4, 26, 0, 0)
    const weekEnd = local(2026, 5, 2, 23, 59)

    const events = tasksToCalendarEvents([task], weekStart, weekEnd)
    const taskEvents = events.filter(e => e.taskId.includes(task.id))

    expect(taskEvents.length).toBe(0)
  })

  it('recurring with future dueDate: skip branch not taken, real event + forward ghosts', () => {
    // dueDate April 30 (tomorrow). dueDate >= today -> skip branch is NOT taken.
    // Real event on April 30, ghosts on May 1 and May 2 from forward projection.
    const task = baseTask({
      id: 'future-daily',
      dueDate: local(2026, 4, 30, 10, 0),
      recurrence: dailyRule,
    })
    const weekStart = local(2026, 4, 26, 0, 0)
    const weekEnd = local(2026, 5, 2, 23, 59)

    const events = tasksToCalendarEvents([task], weekStart, weekEnd)
    const taskEvents = events.filter(e => e.taskId.includes(task.id))

    const real = taskEvents.filter(e => !e.isVirtual)
    const ghosts = taskEvents.filter(e => e.isVirtual)

    expect(real.length).toBe(1)
    expect(real[0]!.date.getDate()).toBe(30)

    expect(ghosts.length).toBe(2)
    const ghostDays = ghosts.map(e => e.date.getDate()).sort((a, b) => a - b)
    expect(ghostDays).toEqual([1, 2])
  })

  it('non-recurring task in window: exactly one real event, no ghosts', () => {
    const task = baseTask({
      id: 'non-recurring',
      dueDate: local(2026, 4, 29, 10, 0),
    })
    const weekStart = local(2026, 4, 26, 0, 0)
    const weekEnd = local(2026, 5, 2, 23, 59)

    const events = tasksToCalendarEvents([task], weekStart, weekEnd)
    const taskEvents = events.filter(e => e.taskId.includes(task.id))

    expect(taskEvents.length).toBe(1)
    expect(taskEvents[0]!.isVirtual).toBe(false)
  })
})
