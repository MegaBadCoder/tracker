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

describe('task store materializeOccurrence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('парсит virtual id, POST /tasks/:id/materialize, кладёт задачу в стор', async () => {
    const occurrence = new Date(2026, 3, 13, 10, 0)
    const virtualId = `root-1__virtual__${occurrence.getTime()}`
    const created: Task = {
      id: 'mat-1',
      title: 'Серия',
      completed: false,
      dueDate: occurrence,
      recurringParentId: 'root-1',
      isAutoCreated: false,
    } as Task

    vi.mocked(api.post).mockResolvedValue({ data: created })
    const store = useTaskStore()

    const result = await store.materializeOccurrence(virtualId)

    expect(api.post).toHaveBeenCalledWith('/tasks/root-1/materialize', {
      occurrenceDate: occurrence.toISOString(),
    })
    expect(result.id).toBe('mat-1')
    expect(store.tasks[0]!.id).toBe('mat-1')
  })
})
