import type { Sprint } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as sprintsApi from '@/features/projects/api/sprints-api'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import { useTaskStore } from '@/features/tasks/model/task-store'

vi.mock('@/features/projects/api/sprints-api', () => ({
  fetchSprints: vi.fn(),
  createSprint: vi.fn(),
  updateSprint: vi.fn(),
  deleteSprint: vi.fn(),
  startSprint: vi.fn(),
  completeSprint: vi.fn(),
}))

function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 'sprint-1',
    userId: 1,
    projectId: 'proj-a',
    name: 'Спринт 1',
    goal: null,
    startDate: null,
    endDate: null,
    status: 'planned',
    completedAt: null,
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Задача',
    completed: false,
    projectId: 'proj-a',
    ...overrides,
  }
}

async function load(store: ReturnType<typeof useSprintStore>, projectId: string, sprints: Sprint[]) {
  vi.mocked(sprintsApi.fetchSprints).mockResolvedValueOnce({ data: sprints } as any)
  await store.fetchSprints(projectId)
}

describe('useSprintStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('загрузка проекта B не меняет sprintsOf(A)', async () => {
    const store = useSprintStore()
    await load(store, 'proj-a', [makeSprint({ id: 'a1' })])
    await load(store, 'proj-b', [makeSprint({ id: 'b1', projectId: 'proj-b' })])

    expect(store.sprintsOf('proj-a').map(s => s.id)).toEqual(['a1'])
    expect(store.sprintsOf('proj-b').map(s => s.id)).toEqual(['b1'])
  })

  it('sprintsOf для незагруженного проекта возвращает пустой список', () => {
    expect(useSprintStore().sprintsOf('unknown')).toEqual([])
  })

  it('ensureSprints не перезагружает уже загруженный проект', async () => {
    const store = useSprintStore()
    await load(store, 'proj-a', [])
    await store.ensureSprints('proj-a')

    expect(sprintsApi.fetchSprints).toHaveBeenCalledTimes(1)
  })

  it('activeSprintOf возвращает единственный активный спринт или null', async () => {
    const store = useSprintStore()
    await load(store, 'proj-a', [
      makeSprint({ id: 'closed', status: 'closed', order: 0 }),
      makeSprint({ id: 'active', status: 'active', order: 1 }),
      makeSprint({ id: 'planned', status: 'planned', order: 2 }),
    ])
    await load(store, 'proj-b', [makeSprint({ id: 'b1', projectId: 'proj-b' })])

    expect(store.activeSprintOf('proj-a')?.id).toBe('active')
    expect(store.activeSprintOf('proj-b')).toBeNull()
    expect(store.activeSprintOf('unknown')).toBeNull()
  })

  it('plannedSprintsOf возвращает только planned, отсортированные по order', async () => {
    const store = useSprintStore()
    await load(store, 'proj-a', [
      makeSprint({ id: 'p2', order: 4 }),
      makeSprint({ id: 'active', status: 'active', order: 0 }),
      makeSprint({ id: 'closed', status: 'closed', order: 1 }),
      makeSprint({ id: 'p1', order: 2 }),
    ])

    expect(store.plannedSprintsOf('proj-a').map(s => s.id)).toEqual(['p1', 'p2'])
  })

  it('createSprint заменяет временный узел ответом сервера', async () => {
    const store = useSprintStore()
    await load(store, 'proj-a', [])
    const created = makeSprint({ id: 'real', name: 'Новый' })
    vi.mocked(sprintsApi.createSprint).mockResolvedValueOnce({ data: created } as any)

    await store.createSprint('proj-a', { name: 'Новый' })

    expect(store.sprintsOf('proj-a')).toEqual([created])
  })

  it('createSprint убирает временный узел при ошибке API', async () => {
    const store = useSprintStore()
    await load(store, 'proj-a', [makeSprint({ id: 'a1' })])
    vi.mocked(sprintsApi.createSprint).mockRejectedValueOnce(new Error('boom'))

    await expect(store.createSprint('proj-a', { name: 'Новый' })).rejects.toThrow('boom')

    expect(store.sprintsOf('proj-a').map(s => s.id)).toEqual(['a1'])
  })

  it('updateSprint откатывает изменение при ошибке API', async () => {
    const store = useSprintStore()
    await load(store, 'proj-a', [makeSprint({ id: 'a1', name: 'Старое' })])
    vi.mocked(sprintsApi.updateSprint).mockRejectedValueOnce(new Error('boom'))

    await expect(store.updateSprint('proj-a', 'a1', { name: 'Новое' })).rejects.toThrow('boom')

    expect(store.sprintsOf('proj-a')[0]!.name).toBe('Старое')
  })

  it('startSprint переводит спринт в active по ответу сервера', async () => {
    const store = useSprintStore()
    await load(store, 'proj-a', [makeSprint({ id: 'a1' })])
    const started = makeSprint({ id: 'a1', status: 'active', startDate: '2026-10-05', endDate: '2026-10-18' })
    vi.mocked(sprintsApi.startSprint).mockResolvedValueOnce({ data: started } as any)

    await store.startSprint('proj-a', 'a1', { startDate: '2026-10-05', endDate: '2026-10-18' })

    expect(store.activeSprintOf('proj-a')).toEqual(started)
  })

  it('startSprint откатывает статус при ошибке API', async () => {
    const store = useSprintStore()
    await load(store, 'proj-a', [makeSprint({ id: 'a1' })])
    vi.mocked(sprintsApi.startSprint).mockRejectedValueOnce(new Error('boom'))

    await expect(
      store.startSprint('proj-a', 'a1', { startDate: '2026-10-05', endDate: '2026-10-18' }),
    ).rejects.toThrow('boom')

    const sprint = store.sprintsOf('proj-a')[0]!
    expect(sprint.status).toBe('planned')
    expect(sprint.startDate).toBeNull()
    expect(store.activeSprintOf('proj-a')).toBeNull()
  })

  describe('deleteSprint', () => {
    it('обнуляет sprintId только у задач удалённого спринта', async () => {
      const store = useSprintStore()
      const taskStore = useTaskStore()
      await load(store, 'proj-a', [makeSprint({ id: 's1' }), makeSprint({ id: 's2', order: 1 })])
      taskStore.tasks = [
        makeTask({ id: 't1', sprintId: 's1' }),
        makeTask({ id: 't2', sprintId: 's2' }),
        makeTask({ id: 't3', sprintId: null }),
      ]
      vi.mocked(sprintsApi.deleteSprint).mockResolvedValueOnce({} as any)

      await store.deleteSprint('proj-a', 's1')

      expect(store.sprintsOf('proj-a').map(s => s.id)).toEqual(['s2'])
      expect(taskStore.tasks.map(t => [t.id, t.sprintId])).toEqual([['t1', null], ['t2', 's2'], ['t3', null]])
    })

    it('при ошибке API возвращает спринт и не меняет задачи', async () => {
      const store = useSprintStore()
      const taskStore = useTaskStore()
      await load(store, 'proj-a', [makeSprint({ id: 's1' })])
      taskStore.tasks = [makeTask({ id: 't1', sprintId: 's1' })]
      vi.mocked(sprintsApi.deleteSprint).mockRejectedValueOnce(new Error('boom'))

      await expect(store.deleteSprint('proj-a', 's1')).rejects.toThrow('boom')

      expect(store.sprintsOf('proj-a').map(s => s.id)).toEqual(['s1'])
      expect(taskStore.tasks[0]!.sprintId).toBe('s1')
    })
  })

  describe('completeSprint', () => {
    async function setup() {
      const store = useSprintStore()
      const taskStore = useTaskStore()
      await load(store, 'proj-a', [
        makeSprint({ id: 's1', status: 'active', order: 0 }),
        makeSprint({ id: 's2', status: 'planned', order: 1 }),
      ])
      taskStore.tasks = [
        makeTask({ id: 'open', sprintId: 's1', completed: false }),
        makeTask({ id: 'done', sprintId: 's1', completed: true }),
        makeTask({ id: 'other-sprint', sprintId: 's2', completed: false }),
        makeTask({ id: 'backlog', sprintId: null, completed: false }),
      ]
      return { store, taskStore }
    }

    function sprintIds(taskStore: ReturnType<typeof useTaskStore>) {
      return Object.fromEntries(taskStore.tasks.map(t => [t.id, t.sprintId]))
    }

    it('в backlog переносит только незавершённые задачи спринта', async () => {
      const { store, taskStore } = await setup()
      vi.mocked(sprintsApi.completeSprint).mockResolvedValueOnce({
        data: makeSprint({ id: 's1', status: 'closed', completedAt: '2026-10-18T10:00:00.000Z' }),
      } as any)

      await store.completeSprint('proj-a', 's1', 'backlog')

      expect(sprintIds(taskStore)).toEqual({ 'open': null, 'done': 's1', 'other-sprint': 's2', 'backlog': null })
      expect(sprintsApi.completeSprint).toHaveBeenCalledWith('proj-a', 's1', { moveTo: 'backlog' })
      expect(store.sprintsOf('proj-a').find(s => s.id === 's1')!.status).toBe('closed')
      expect(store.activeSprintOf('proj-a')).toBeNull()
    })

    it('в другой спринт переносит незавершённые задачи с id цели', async () => {
      const { store, taskStore } = await setup()
      vi.mocked(sprintsApi.completeSprint).mockResolvedValueOnce({
        data: makeSprint({ id: 's1', status: 'closed' }),
      } as any)

      await store.completeSprint('proj-a', 's1', 's2')

      expect(sprintIds(taskStore)).toEqual({ 'open': 's2', 'done': 's1', 'other-sprint': 's2', 'backlog': null })
    })

    it('при ошибке API откатывает статус и не меняет задачи', async () => {
      const { store, taskStore } = await setup()
      vi.mocked(sprintsApi.completeSprint).mockRejectedValueOnce(new Error('boom'))

      await expect(store.completeSprint('proj-a', 's1', 'backlog')).rejects.toThrow('boom')

      expect(sprintIds(taskStore)).toEqual({ 'open': 's1', 'done': 's1', 'other-sprint': 's2', 'backlog': null })
      expect(store.activeSprintOf('proj-a')?.id).toBe('s1')
    })
  })
})
