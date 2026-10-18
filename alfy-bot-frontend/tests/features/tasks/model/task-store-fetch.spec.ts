import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { useTaskStore } from '@/features/tasks/model/task-store'

vi.mock('@/api/client', () => ({ api: { get: vi.fn() } }))

describe('fetchTask', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })
  it('loads and merges one task without dropping others, parsing dates and config', async () => {
    const store = useTaskStore()
    store.tasks = [{ id: 'other', title: 'Other' }, { id: 'one', title: 'Stale' }] as never
    vi.mocked(api.get).mockResolvedValue({ data: { id: 'one', title: 'Fresh', dueDate: '2026-10-18T10:00:00Z', goalIds: [2], pomodoroConfig: { pomodoroCount: 3 } } })
    const result = await store.fetchTask('one')
    expect(api.get).toHaveBeenCalledWith('/tasks/one')
    expect(result.dueDate).toBeInstanceOf(Date)
    expect(result.pomodoroCount).toBe(3)
    expect(result.goalIds).toEqual([2])
    expect(store.tasks.map(t => t.title)).toEqual(['Other', 'Fresh'])
    await store.fetchTask('one')
    expect(store.tasks).toHaveLength(2)
  })
  it('adds a task to an empty store and rethrows failure without mutation', async () => {
    const store = useTaskStore()
    vi.mocked(api.get).mockResolvedValueOnce({ data: { id: 'one', title: 'Fresh' } })
    await store.fetchTask('one')
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Unavailable'))
    await expect(store.fetchTask('other')).rejects.toThrow('Unavailable')
    expect(store.tasks.map(t => t.id)).toEqual(['one'])
  })
})
