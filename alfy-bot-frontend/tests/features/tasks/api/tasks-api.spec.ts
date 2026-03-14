import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '@/api/client'
import { useTasks } from '@/features/tasks/api/tasks-api'
import type { Task } from '@/features/tasks/model/types'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('tasks-api createTask и отправка на backend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createTask отправляет POST /tasks с корректным payload', async () => {
    const mockTask: Task = {
      id: '10',
      title: 'Тестовая задача',
      description: 'Описание',
      completed: false,
      priority: 'high',
      tags: ['тест'],
      isPomodoroTask: true,
      pomodoroCompleted: 0,
      pomodoroCount: 4,
      pomodoroDuration: 25,
      shortBreak: 5,
      longBreak: 15,
      longBreakInterval: 4,
    }

    vi.mocked(api.post).mockResolvedValue({ data: mockTask })

    const { createTask } = useTasks()

    const taskData: Omit<Task, 'id' | 'pomodoroCompleted'> = {
      title: 'Тестовая задача',
      description: 'Описание',
      completed: false,
      priority: 'high',
      tags: ['тест'],
      isPomodoroTask: true,
      pomodoroCount: 4,
      pomodoroDuration: 25,
      shortBreak: 5,
      longBreak: 15,
      longBreakInterval: 4,
    }

    const result = await createTask(taskData)

    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/tasks', taskData)
    expect(result.title).toBe('Тестовая задача')
    expect(result.id).toBe('10')
  })

  it('createTask добавляет задачу в список до ответа и заменяет temp после успеха', async () => {
    const mockTask: Task = {
      id: '20',
      title: 'Optimistic task',
      completed: false,
      pomodoroCompleted: 0,
    }

    let resolvePost: (value: { data: Task }) => void
    const postPromise = new Promise<{ data: Task }>(r => { resolvePost = r })

    vi.mocked(api.post).mockReturnValue(postPromise)

    const { tasks, createTask } = useTasks()

    const createPromise = createTask({
      title: 'Optimistic task',
      completed: false,
    })

    await vi.waitFor(() => {
      expect(tasks.value.length).toBe(1)
      expect(tasks.value[0]!.id).toMatch(/^temp-/)
      expect(tasks.value[0]!.title).toBe('Optimistic task')
    })

    resolvePost!({ data: mockTask })
    await createPromise

    expect(tasks.value[0].id).toBe('20')
    expect(tasks.value[0].title).toBe('Optimistic task')
  })

  it('createTask откатывает optimistic update при ошибке', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Network error'))

    const { tasks, createTask, error } = useTasks()

    await expect(createTask({
      title: 'Failing task',
      completed: false,
    })).rejects.toThrow()

    expect(tasks.value.length).toBe(0)
    expect(error.value).toBeTruthy()
  })
})
