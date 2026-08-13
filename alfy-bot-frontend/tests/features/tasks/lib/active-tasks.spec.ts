import type { Task } from '@/features/tasks/model/types'
import { describe, expect, it } from 'vitest'
import { getActiveTasksAt } from '@/features/tasks/lib/active-tasks'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Задача',
    completed: false,
    ...overrides,
  } as Task
}

/** Обычная задача без помидоров: окно = durationMinutes, дефолт 60. */
function plain(start: string, durationMinutes?: number, overrides: Partial<Task> = {}): Task {
  return makeTask({ dueDate: new Date(start), durationMinutes, ...overrides })
}

const at = (iso: string) => new Date(iso)

describe('getActiveTasksAt', () => {
  it('now ровно на начале — задача активна', () => {
    const task = plain('2026-08-13T12:00:00', 60)
    expect(getActiveTasksAt([task], at('2026-08-13T12:00:00'))).toEqual([task])
  })

  it('now за минуту до конца — задача активна', () => {
    const task = plain('2026-08-13T12:00:00', 60)
    expect(getActiveTasksAt([task], at('2026-08-13T12:59:00'))).toEqual([task])
  })

  it('now ровно на конце — задача НЕ активна', () => {
    const task = plain('2026-08-13T12:00:00', 60)
    expect(getActiveTasksAt([task], at('2026-08-13T13:00:00'))).toEqual([])
  })

  it('now до начала — задача не активна', () => {
    const task = plain('2026-08-13T12:00:00', 60)
    expect(getActiveTasksAt([task], at('2026-08-13T11:59:00'))).toEqual([])
  })

  it('задача без dueDate не активна', () => {
    const task = makeTask({ durationMinutes: 60 })
    expect(getActiveTasksAt([task], at('2026-08-13T12:00:00'))).toEqual([])
  })

  it('all-day задача (время ровно 00:00) не активна', () => {
    const task = plain('2026-08-13T00:00:00', 60)
    expect(getActiveTasksAt([task], at('2026-08-13T00:30:00'))).toEqual([])
  })

  it('выполненная задача внутри окна не активна', () => {
    const task = plain('2026-08-13T12:00:00', 60, { completed: true })
    expect(getActiveTasksAt([task], at('2026-08-13T12:30:00'))).toEqual([])
  })

  it('overdue задача внутри окна не активна', () => {
    const task = plain('2026-08-13T12:00:00', 60, { isOverdue: true })
    expect(getActiveTasksAt([task], at('2026-08-13T12:30:00'))).toEqual([])
  })

  it('не-помидоро задача без durationMinutes получает окно в 60 минут', () => {
    const task = plain('2026-08-13T12:00:00')
    expect(getActiveTasksAt([task], at('2026-08-13T12:59:00'))).toEqual([task])
    expect(getActiveTasksAt([task], at('2026-08-13T13:00:00'))).toEqual([])
  })

  it('окно помидоро-задачи включает перерывы: 2x25 + 5 = 55 минут', () => {
    // Соответствует «Гитаре» 11:35–12:30 из макета.
    const task = makeTask({
      dueDate: new Date('2026-08-13T11:35:00'),
      isPomodoroTask: true,
      pomodoroCount: 2,
      pomodoroDuration: 25,
      shortBreak: 5,
      longBreak: 15,
      longBreakInterval: 4,
    })
    expect(getActiveTasksAt([task], at('2026-08-13T12:29:00'))).toEqual([task])
    expect(getActiveTasksAt([task], at('2026-08-13T12:30:00'))).toEqual([])
  })

  it('две пересекающиеся активные задачи возвращаются обе, по возрастанию начала', () => {
    const long = plain('2026-08-13T15:45:00', 230, { id: 'long' })
    const short = plain('2026-08-13T16:00:00', 30, { id: 'short' })
    const result = getActiveTasksAt([short, long], at('2026-08-13T16:10:00'))
    expect(result.map(t => t.id)).toEqual(['long', 'short'])
  })
})
