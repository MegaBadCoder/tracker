import type { Task } from '@/features/tasks/model/types'
import { describe, expect, it } from 'vitest'
import { toTimerTask } from '@/features/task-timer/lib/to-timer-task'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Задача',
    completed: false,
    isPomodoroTask: true,
    ...overrides,
  } as Task
}

describe('toTimerTask', () => {
  it('переносит заполненные настройки один в один', () => {
    const task = makeTask({
      pomodoroDuration: 50,
      shortBreak: 10,
      longBreak: 30,
      longBreakInterval: 2,
      pomodoroCount: 8,
    })

    expect(toTimerTask(task)).toEqual({
      id: 'task-1',
      pomodoroTime: 50,
      breakTime: 10,
      longBreakTime: 30,
      longBreakInterval: 2,
      pomodoroCount: 8,
    })
  })

  it('подставляет дефолты, когда настроек нет', () => {
    expect(toTimerTask(makeTask())).toEqual({
      id: 'task-1',
      pomodoroTime: 25,
      breakTime: 5,
      longBreakTime: 15,
      longBreakInterval: 4,
      pomodoroCount: 4,
    })
  })

  // Регрессия: исходные вызовы использовали ||, а не ??. Ноль обязан
  // схлопываться в дефолт — подмена оператора на ?? сломает этот тест.
  it('нулевые значения схлопываются в дефолты, а не остаются нулями', () => {
    const task = makeTask({
      pomodoroDuration: 0,
      shortBreak: 0,
      longBreak: 0,
      longBreakInterval: 0,
      pomodoroCount: 0,
    })

    expect(toTimerTask(task)).toEqual({
      id: 'task-1',
      pomodoroTime: 25,
      breakTime: 5,
      longBreakTime: 15,
      longBreakInterval: 4,
      pomodoroCount: 4,
    })
  })

  it('переносит id без изменений', () => {
    expect(toTimerTask(makeTask({ id: 'другой-id' })).id).toBe('другой-id')
  })
})
