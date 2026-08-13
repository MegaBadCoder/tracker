import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { api } from '@/api/client'
import type { Task } from '@/features/tasks/model/types'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

/** Raw backend shape — pomodoro fields live under pomodoroConfig, not on the task. */
function rawTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    title: 'Задача',
    completed: false,
    pomodoroConfig: {
      pomodoroCount: 4,
      pomodoroDuration: 25,
      shortBreak: 5,
      longBreak: 15,
      longBreakInterval: 4,
      pomodoroCompleted: 3,
    },
    ...overrides,
  }
}

describe('task store incrementPomodoro', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  async function seedStore(raw: Record<string, unknown>[] = [rawTask()]) {
    vi.mocked(api.get).mockResolvedValue({ data: raw })
    const store = useTaskStore()
    await store.fetchTasks()
    return store
  }

  it('оптимистично бампает pomodoroCompleted до ответа', async () => {
    const store = await seedStore()
    vi.mocked(api.patch).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ data: { task: rawTask() } } as never), 100)),
    )

    const promise = store.incrementPomodoro('task-1', 0.6)

    expect(store.tasks[0]!.pomodoroCompleted).toBe(3.6)

    await promise
  })

  it('отправляет PATCH /tasks/:id/pomodoro с increment', async () => {
    const store = await seedStore()
    vi.mocked(api.patch).mockResolvedValue({ data: { task: rawTask() } })

    await store.incrementPomodoro('task-1', 1)

    expect(api.patch).toHaveBeenCalledWith('/tasks/task-1/pomodoro', { increment: 1 })
  })

  it('применяет автозакрытие из ответа бэкенда', async () => {
    const store = await seedStore()
    vi.mocked(api.patch).mockResolvedValue({
      data: {
        task: rawTask({
          completed: true,
          pomodoroConfig: { pomodoroCount: 4, pomodoroCompleted: 4 },
        }),
      },
    })

    await store.incrementPomodoro('task-1', 1)

    expect(store.tasks[0]!.completed).toBe(true)
    expect(store.tasks[0]!.pomodoroCompleted).toBe(4)
  })

  it('добавляет nextInstance из ответа в стор', async () => {
    const store = await seedStore()
    vi.mocked(api.patch).mockResolvedValue({
      data: {
        task: rawTask({ completed: true }),
        nextInstance: rawTask({ id: 'task-2', title: 'Следующий инстанс' }),
      },
    })

    await store.incrementPomodoro('task-1', 1)

    expect(store.tasks.find((t: Task) => t.id === 'task-2')).toBeDefined()
  })

  it('откатывает бамп при ошибке API', async () => {
    const store = await seedStore()
    vi.mocked(api.patch).mockRejectedValue(new Error('Ошибка'))

    await store.incrementPomodoro('task-1', 0.6)

    expect(store.tasks[0]!.pomodoroCompleted).toBe(3)
  })

  it('отправляет запрос даже если задачи нет в локальном сторе', async () => {
    const store = await seedStore([])
    vi.mocked(api.patch).mockResolvedValue({ data: { task: rawTask() } })

    await store.incrementPomodoro('missing-task', 1)

    expect(api.patch).toHaveBeenCalledWith('/tasks/missing-task/pomodoro', { increment: 1 })
  })
})
