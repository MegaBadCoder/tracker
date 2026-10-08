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

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Задача',
    completed: false,
    projectId: 'proj-1',
    columnId: 'col-1',
    order: 0,
    ...overrides,
  } as Task
}

describe('task store move actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  function seedTasks(tasks: Task[]) {
    vi.mocked(api.get).mockResolvedValue({ data: tasks })
    const store = useTaskStore()
    return store.fetchTasks().then(() => store)
  }

  // ── moveTask ────────────────────────────────────────────────────

  describe('moveTask', () => {
    it('optimistic обновляет columnId и order', async () => {
      const store = await seedTasks([makeTask()])

      vi.mocked(api.patch).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} } as any), 100)),
      )

      const promise = store.moveTask('task-1', 'proj-1', { columnId: 'col-2', order: 3 })

      expect(store.tasks[0].columnId).toBe('col-2')
      expect(store.tasks[0].order).toBe(3)

      await promise
    })

    it('отправляет PATCH /projects/:id/tasks/:taskId/move', async () => {
      const store = await seedTasks([makeTask()])
      vi.mocked(api.patch).mockResolvedValue({ data: {} })

      await store.moveTask('task-1', 'proj-1', { columnId: 'col-2', order: 1 })

      expect(api.patch).toHaveBeenCalledWith(
        '/projects/proj-1/tasks/task-1/move',
        { columnId: 'col-2', order: 1 },
      )
    })

    it('откатывает при ошибке API', async () => {
      const store = await seedTasks([makeTask({ columnId: 'col-1', order: 0 })])
      vi.mocked(api.patch).mockRejectedValue(new Error('Ошибка'))

      await expect(
        store.moveTask('task-1', 'proj-1', { columnId: 'col-2', order: 5 }),
      ).rejects.toThrow()

      expect(store.tasks[0].columnId).toBe('col-1')
      expect(store.tasks[0].order).toBe(0)
    })

    it('при переезде в другой проект сбрасывает номер, спринт и релиз, затем берёт их из ответа сервера', async () => {
      const store = await seedTasks([makeTask({ number: 14, sprintId: 's-1', releaseId: 'r-1' })])
      let resolveMove!: (value: unknown) => void
      vi.mocked(api.patch).mockImplementation(() => new Promise((resolve) => { resolveMove = resolve }))

      const promise = store.moveTask('task-1', 'proj-2', {})

      expect(store.tasks[0].number).toBeNull()
      expect(store.tasks[0].sprintId).toBeNull()
      expect(store.tasks[0].releaseId).toBeNull()

      resolveMove({
        data: makeTask({ projectId: 'proj-2', columnId: 'col-9', number: 1, sprintId: null, releaseId: null }),
      })
      await promise

      expect(store.tasks[0].number).toBe(1)
      expect(store.tasks[0].columnId).toBe('col-9')
    })

    it('при ошибке переезда возвращает номер, спринт и релиз', async () => {
      const store = await seedTasks([makeTask({ number: 14, sprintId: 's-1', releaseId: 'r-1' })])
      vi.mocked(api.patch).mockRejectedValue(new Error('Ошибка'))

      await expect(store.moveTask('task-1', 'proj-2', {})).rejects.toThrow()

      expect(store.tasks[0].number).toBe(14)
      expect(store.tasks[0].sprintId).toBe('s-1')
      expect(store.tasks[0].releaseId).toBe('r-1')
      expect(store.tasks[0].projectId).toBe('proj-1')
    })
  })

  // ── moveTask (inbox) ────────────────────────────────────────────

  describe('moveTask с projectId === null', () => {
    it('optimistic обновляет projectId и columnId в null', async () => {
      const store = await seedTasks([makeTask()])

      vi.mocked(api.patch).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} } as any), 100)),
      )

      const promise = store.moveTask('task-1', null, { columnId: null, order: 2 })

      expect(store.tasks[0].projectId).toBeNull()
      expect(store.tasks[0].columnId).toBeNull()
      expect(store.tasks[0].order).toBe(2)

      await promise
    })

    it('отправляет PATCH /tasks/:id/move-to-inbox', async () => {
      const store = await seedTasks([makeTask()])
      vi.mocked(api.patch).mockResolvedValue({ data: {} })

      await store.moveTask('task-1', null, { order: 5 })

      expect(api.patch).toHaveBeenCalledWith(
        '/tasks/task-1/move-to-inbox',
        { order: 5 },
      )
    })

    it('отправляет пустой body если order не передан', async () => {
      const store = await seedTasks([makeTask()])
      vi.mocked(api.patch).mockResolvedValue({ data: {} })

      await store.moveTask('task-1', null, {})

      expect(api.patch).toHaveBeenCalledWith(
        '/tasks/task-1/move-to-inbox',
        {},
      )
    })

    it('откатывает при ошибке API', async () => {
      const store = await seedTasks([makeTask({ projectId: 'proj-1', columnId: 'col-1', order: 0 })])
      vi.mocked(api.patch).mockRejectedValue(new Error('Ошибка'))

      await expect(
        store.moveTask('task-1', null, { columnId: null, order: 3 }),
      ).rejects.toThrow()

      expect(store.tasks[0].projectId).toBe('proj-1')
      expect(store.tasks[0].columnId).toBe('col-1')
      expect(store.tasks[0].order).toBe(0)
    })
  })

  // ── reorderInboxTasks ───────────────────────────────────────────

  describe('reorderInboxTasks', () => {
    it('optimistic обновляет order по индексу', async () => {
      const store = await seedTasks([
        makeTask({ id: 'task-1', order: 0, projectId: undefined }),
        makeTask({ id: 'task-2', order: 1, projectId: undefined }),
      ])

      vi.mocked(api.patch).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} } as any), 100)),
      )

      const promise = store.reorderInboxTasks(['task-2', 'task-1'])

      expect(store.tasks.find(t => t.id === 'task-2')?.order).toBe(0)
      expect(store.tasks.find(t => t.id === 'task-1')?.order).toBe(1)

      await promise
    })

    it('отправляет PATCH /tasks/reorder', async () => {
      const store = await seedTasks([makeTask({ id: 'task-1', projectId: undefined })])
      vi.mocked(api.patch).mockResolvedValue({ data: {} })

      await store.reorderInboxTasks(['task-1'])

      expect(api.patch).toHaveBeenCalledWith(
        '/tasks/reorder',
        { orderedIds: ['task-1'] },
      )
    })

    it('откатывает при ошибке', async () => {
      const store = await seedTasks([
        makeTask({ id: 'task-1', order: 0, projectId: undefined }),
        makeTask({ id: 'task-2', order: 1, projectId: undefined }),
      ])
      vi.mocked(api.patch).mockRejectedValue(new Error('Ошибка'))

      await expect(
        store.reorderInboxTasks(['task-2', 'task-1']),
      ).rejects.toThrow()

      expect(store.tasks.find(t => t.id === 'task-1')?.order).toBe(0)
      expect(store.tasks.find(t => t.id === 'task-2')?.order).toBe(1)
    })
  })

  // ── reorderTasks ────────────────────────────────────────────────

  describe('reorderTasks', () => {
    it('optimistic обновляет order', async () => {
      const store = await seedTasks([
        makeTask({ id: 'task-1', order: 0 }),
        makeTask({ id: 'task-2', order: 1 }),
      ])

      vi.mocked(api.patch).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} } as any), 100)),
      )

      const promise = store.reorderTasks('proj-1', ['task-2', 'task-1'])

      expect(store.tasks.find(t => t.id === 'task-2')?.order).toBe(0)
      expect(store.tasks.find(t => t.id === 'task-1')?.order).toBe(1)

      await promise
    })

    it('отправляет PATCH /projects/:id/tasks/reorder', async () => {
      const store = await seedTasks([makeTask()])
      vi.mocked(api.patch).mockResolvedValue({ data: {} })

      await store.reorderTasks('proj-1', ['task-1'], 'col-1')

      expect(api.patch).toHaveBeenCalledWith(
        '/projects/proj-1/tasks/reorder',
        { orderedIds: ['task-1'], columnId: 'col-1' },
      )
    })

    it('откатывает при ошибке', async () => {
      const store = await seedTasks([
        makeTask({ id: 'task-1', order: 0 }),
        makeTask({ id: 'task-2', order: 1 }),
      ])
      vi.mocked(api.patch).mockRejectedValue(new Error('Ошибка'))

      await expect(
        store.reorderTasks('proj-1', ['task-2', 'task-1']),
      ).rejects.toThrow()

      expect(store.tasks.find(t => t.id === 'task-1')?.order).toBe(0)
      expect(store.tasks.find(t => t.id === 'task-2')?.order).toBe(1)
    })
  })
})
