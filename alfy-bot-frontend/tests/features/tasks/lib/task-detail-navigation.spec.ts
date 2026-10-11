import type { Task } from '@/features/tasks/model/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openTaskDetail, registerTaskOpener } from '@/features/tasks/lib/task-detail-navigation'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Задача',
    completed: false,
    ...overrides,
  }
}

describe('taskDetailNavigation', () => {
  let unregister: (() => void) | null = null

  afterEach(() => {
    unregister?.()
    unregister = null
  })

  it('openTaskDetail вызывает зарегистрированный обработчик с задачей', () => {
    const handler = vi.fn()
    unregister = registerTaskOpener(handler)

    const task = makeTask()
    openTaskDetail(task)

    expect(handler).toHaveBeenCalledWith(task)
  })

  it('unregister старой регистрации не снимает новую', () => {
    const firstHandler = vi.fn()
    const firstUnregister = registerTaskOpener(firstHandler)

    const secondHandler = vi.fn()
    unregister = registerTaskOpener(secondHandler)

    firstUnregister()

    const task = makeTask()
    openTaskDetail(task)

    expect(firstHandler).not.toHaveBeenCalled()
    expect(secondHandler).toHaveBeenCalledWith(task)
  })

  it('без зарегистрированного обработчика пишет ошибку в console.error и не падает', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => openTaskDetail(makeTask())).not.toThrow()
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})
