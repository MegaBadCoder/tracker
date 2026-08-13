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

describe('tasksToCalendarEvents — this-only reschedule keeps series ghosts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(local(2026, 4, 8, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('real event at dueDate, ghosts from recurrenceAnchorDate (Mon 10:00 → Wed 15:00)', () => {
    const weekly: RecurrenceRule = { frequency: 'weekly', interval: 1 }
    const task = baseTask({
      id: 'moved',
      dueDate: local(2026, 4, 8, 15, 0),
      recurrenceAnchorDate: local(2026, 4, 6, 10, 0),
      recurrence: weekly,
    })
    const weekStart = local(2026, 4, 6, 0, 0)
    const weekEnd = local(2026, 4, 19, 23, 59)

    const events = tasksToCalendarEvents([task], weekStart, weekEnd)
    const real = events.filter(e => !e.isVirtual)
    const ghosts = events.filter(e => e.isVirtual)

    expect(real).toHaveLength(1)
    expect(real[0]!.date).toEqual(local(2026, 4, 8, 15, 0))

    expect(ghosts).toHaveLength(1)
    expect(ghosts[0]!.date).toEqual(local(2026, 4, 13, 10, 0))
  })
})

describe('tasksToCalendarEvents — occupied series slots / ghosts from root', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(local(2026, 4, 6, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const weekly: RecurrenceRule = { frequency: 'weekly', interval: 1 }

  it('не рисует ghost на дне проявленного sibling', () => {
    const root = baseTask({
      id: 'root-1',
      dueDate: local(2026, 4, 6, 10, 0),
      recurrence: weekly,
    })
    const materialized = baseTask({
      id: 'mat-1',
      recurringParentId: 'root-1',
      dueDate: local(2026, 4, 13, 10, 0),
      recurrence: weekly,
      isAutoCreated: false,
    })
    const weekStart = local(2026, 4, 6, 0, 0)
    const weekEnd = local(2026, 4, 19, 23, 59)

    const events = tasksToCalendarEvents([root, materialized], weekStart, weekEnd)
    const ghosts = events.filter(e => e.isVirtual)
    const reals = events.filter(e => !e.isVirtual)

    expect(reals.map(e => e.taskId).sort()).toEqual(['mat-1', 'root-1'])
    expect(ghosts).toHaveLength(0)
  })

  it('ghosts от root, не от проявленной; занятый слот sibling не рисуется', () => {
    const root = baseTask({
      id: 'root-1',
      dueDate: local(2026, 4, 6, 10, 0),
      recurrence: weekly,
      completed: true,
      recurringCompletedCount: 1,
    })
    const current = baseTask({
      id: 'inst-1',
      recurringParentId: 'root-1',
      dueDate: local(2026, 4, 13, 10, 0),
      recurrence: weekly,
      isAutoCreated: true,
    })
    const materialized = baseTask({
      id: 'mat-1',
      recurringParentId: 'root-1',
      dueDate: local(2026, 4, 20, 10, 0),
      recurrenceAnchorDate: local(2026, 4, 20, 10, 0),
      recurrence: weekly,
      isAutoCreated: false,
    })
    const weekStart = local(2026, 4, 6, 0, 0)
    const weekEnd = local(2026, 4, 27, 23, 59)

    const events = tasksToCalendarEvents(
      [root, current, materialized],
      weekStart,
      weekEnd,
    )
    const ghosts = events.filter(e => e.isVirtual)
    const reals = events.filter(e => !e.isVirtual)

    expect(reals).toHaveLength(3)
    expect(ghosts).toHaveLength(1)
    expect(ghosts[0]!.date).toEqual(local(2026, 4, 27, 10, 0))
    expect(ghosts[0]!.taskId.startsWith('inst-1__virtual__')).toBe(true)
  })

  it('this-only sibling занимает слот якоря, не dueDate', () => {
    const root = baseTask({
      id: 'root-1',
      dueDate: local(2026, 4, 6, 10, 0),
      recurrence: weekly,
    })
    const materialized = baseTask({
      id: 'mat-1',
      recurringParentId: 'root-1',
      dueDate: local(2026, 4, 15, 15, 0),
      recurrenceAnchorDate: local(2026, 4, 13, 10, 0),
      recurrence: weekly,
      isAutoCreated: false,
    })
    const weekStart = local(2026, 4, 6, 0, 0)
    const weekEnd = local(2026, 4, 19, 23, 59)

    const events = tasksToCalendarEvents([root, materialized], weekStart, weekEnd)
    const ghosts = events.filter(e => e.isVirtual)
    const reals = events.filter(e => !e.isVirtual)

    expect(reals.map(e => e.date.getDate()).sort((a, b) => a - b)).toEqual([6, 15])
    expect(ghosts).toHaveLength(0)
  })

  it('не рисует ghosts если в семье нет живого курсора (только overdue/completed)', () => {
    const root = baseTask({
      id: 'root-1',
      dueDate: local(2026, 4, 6, 18, 0),
      recurrence: weekly,
      completed: true,
    })
    const overdue = baseTask({
      id: 'ov-1',
      recurringParentId: 'root-1',
      dueDate: local(2026, 4, 8, 18, 0),
      isOverdue: true,
      recurrence: weekly,
    })
    const weekStart = local(2026, 4, 6, 0, 0)
    const weekEnd = local(2026, 4, 19, 23, 59)

    const events = tasksToCalendarEvents([root, overdue], weekStart, weekEnd)
    expect(events.filter(e => e.isVirtual)).toHaveLength(0)
  })
})
