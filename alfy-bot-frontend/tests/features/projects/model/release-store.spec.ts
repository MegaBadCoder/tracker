import type { Release } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as groupsApi from '@/features/projects/api/groups-api'
import * as releasesApi from '@/features/projects/api/releases-api'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useReleaseStore } from '@/features/projects/model/release-store'
import { useTaskStore } from '@/features/tasks/model/task-store'

vi.mock('@/features/projects/api/groups-api', () => ({ setGroupRelease: vi.fn(), fetchGroups: vi.fn() }))

vi.mock('@/features/projects/api/releases-api', () => ({
  fetchReleases: vi.fn(),
  createRelease: vi.fn(),
  updateRelease: vi.fn(),
  deleteRelease: vi.fn(),
  releaseRelease: vi.fn(),
  assignGroupToRelease: vi.fn(),
}))

function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: 'rel-1',
    userId: 1,
    projectId: 'proj-a',
    name: 'v1.0',
    description: null,
    startDate: null,
    releaseDate: null,
    status: 'planned',
    releasedAt: null,
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

async function load(store: ReturnType<typeof useReleaseStore>, projectId: string, releases: Release[]) {
  vi.mocked(releasesApi.fetchReleases).mockResolvedValueOnce({ data: releases } as any)
  await store.fetchReleases(projectId)
}

describe('useReleaseStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(groupsApi.fetchGroups).mockResolvedValue({ data: [] } as any)
  })

  it('загрузка проекта B не меняет releasesOf(A)', async () => {
    const store = useReleaseStore()
    await load(store, 'proj-a', [makeRelease({ id: 'a1' })])
    await load(store, 'proj-b', [makeRelease({ id: 'b1', projectId: 'proj-b' })])

    expect(store.releasesOf('proj-a').map(r => r.id)).toEqual(['a1'])
    expect(store.releasesOf('proj-b').map(r => r.id)).toEqual(['b1'])
  })

  it('releasesOf для незагруженного проекта возвращает пустой список', () => {
    expect(useReleaseStore().releasesOf('unknown')).toEqual([])
  })

  it('ensureReleases не перезагружает уже загруженный проект', async () => {
    const store = useReleaseStore()
    await load(store, 'proj-a', [])
    await store.ensureReleases('proj-a')

    expect(releasesApi.fetchReleases).toHaveBeenCalledTimes(1)
  })

  it('isLoading истинно во время загрузки и ложно после', async () => {
    const store = useReleaseStore()
    let resolve!: (value: unknown) => void
    vi.mocked(releasesApi.fetchReleases).mockReturnValueOnce(new Promise(r => (resolve = r)) as any)

    const pending = store.fetchReleases('proj-a')
    expect(store.isLoading('proj-a')).toBe(true)
    expect(store.isLoading('proj-b')).toBe(false)

    resolve({ data: [] })
    await pending
    expect(store.isLoading('proj-a')).toBe(false)
  })

  it('plannedReleasesOf возвращает только planned, отсортированные по order', async () => {
    const store = useReleaseStore()
    await load(store, 'proj-a', [
      makeRelease({ id: 'p2', order: 4 }),
      makeRelease({ id: 'done', status: 'released', order: 0 }),
      makeRelease({ id: 'p1', order: 2 }),
    ])

    expect(store.plannedReleasesOf('proj-a').map(r => r.id)).toEqual(['p1', 'p2'])
  })

  it('releasedReleasesOf возвращает только released, свежие выпуски первыми', async () => {
    const store = useReleaseStore()
    await load(store, 'proj-a', [
      makeRelease({ id: 'old', status: 'released', releasedAt: '2026-03-01T10:00:00.000Z' }),
      makeRelease({ id: 'planned' }),
      makeRelease({ id: 'new', status: 'released', releasedAt: '2026-05-01T10:00:00.000Z' }),
    ])

    expect(store.releasedReleasesOf('proj-a').map(r => r.id)).toEqual(['new', 'old'])
  })

  it('createRelease заменяет временный узел ответом сервера', async () => {
    const store = useReleaseStore()
    await load(store, 'proj-a', [])
    const created = makeRelease({ id: 'real', name: 'Новый' })
    vi.mocked(releasesApi.createRelease).mockResolvedValueOnce({ data: created } as any)

    const result = await store.createRelease('proj-a', { name: 'Новый' })

    expect(result).toEqual(created)
    expect(store.releasesOf('proj-a')).toEqual([created])
  })

  it('createRelease показывает временный узел до ответа сервера', async () => {
    const store = useReleaseStore()
    await load(store, 'proj-a', [])
    let resolve!: (value: unknown) => void
    vi.mocked(releasesApi.createRelease).mockReturnValueOnce(new Promise(r => (resolve = r)) as any)

    const pending = store.createRelease('proj-a', { name: 'Новый', description: 'Описание' })

    expect(store.releasesOf('proj-a')).toHaveLength(1)
    expect(store.releasesOf('proj-a')[0]).toMatchObject({ name: 'Новый', description: 'Описание', status: 'planned' })

    resolve({ data: makeRelease({ id: 'real' }) })
    await pending
  })

  it('createRelease убирает временный узел при ошибке API', async () => {
    const store = useReleaseStore()
    await load(store, 'proj-a', [makeRelease({ id: 'a1' })])
    vi.mocked(releasesApi.createRelease).mockRejectedValueOnce(new Error('boom'))

    await expect(store.createRelease('proj-a', { name: 'Новый' })).rejects.toThrow('boom')

    expect(store.releasesOf('proj-a').map(r => r.id)).toEqual(['a1'])
  })

  it('updateRelease применяет ответ сервера', async () => {
    const store = useReleaseStore()
    await load(store, 'proj-a', [makeRelease({ id: 'a1', name: 'Старое' })])
    vi.mocked(releasesApi.updateRelease).mockResolvedValueOnce({
      data: makeRelease({ id: 'a1', name: 'Новое', updatedAt: '2026-02-01T00:00:00.000Z' }),
    } as any)

    await store.updateRelease('proj-a', 'a1', { name: 'Новое' })

    expect(store.releasesOf('proj-a')[0]).toMatchObject({ name: 'Новое', updatedAt: '2026-02-01T00:00:00.000Z' })
    expect(releasesApi.updateRelease).toHaveBeenCalledWith('proj-a', 'a1', { name: 'Новое' })
  })

  it('updateRelease откатывает изменение при ошибке API', async () => {
    const store = useReleaseStore()
    await load(store, 'proj-a', [makeRelease({ id: 'a1', name: 'Старое' })])
    vi.mocked(releasesApi.updateRelease).mockRejectedValueOnce(new Error('boom'))

    await expect(store.updateRelease('proj-a', 'a1', { name: 'Новое' })).rejects.toThrow('boom')

    expect(store.releasesOf('proj-a')[0]!.name).toBe('Старое')
  })

  describe('deleteRelease', () => {
    it('обнуляет releaseId только у задач удалённого релиза', async () => {
      const store = useReleaseStore()
      const taskStore = useTaskStore()
      await load(store, 'proj-a', [makeRelease({ id: 'r1' }), makeRelease({ id: 'r2', order: 1 })])
      taskStore.tasks = [
        makeTask({ id: 't1', releaseId: 'r1' }),
        makeTask({ id: 't2', releaseId: 'r2' }),
        makeTask({ id: 't3', releaseId: null }),
      ]
      vi.mocked(releasesApi.deleteRelease).mockResolvedValueOnce({} as any)

      await store.deleteRelease('proj-a', 'r1')

      expect(store.releasesOf('proj-a').map(r => r.id)).toEqual(['r2'])
      expect(taskStore.tasks.map(t => [t.id, t.releaseId])).toEqual([['t1', null], ['t2', 'r2'], ['t3', null]])
    })

    it('при ошибке API возвращает релиз и не меняет задачи', async () => {
      const store = useReleaseStore()
      const taskStore = useTaskStore()
      await load(store, 'proj-a', [makeRelease({ id: 'r1' })])
      taskStore.tasks = [makeTask({ id: 't1', releaseId: 'r1' })]
      vi.mocked(releasesApi.deleteRelease).mockRejectedValueOnce(new Error('boom'))

      await expect(store.deleteRelease('proj-a', 'r1')).rejects.toThrow('boom')

      expect(store.releasesOf('proj-a').map(r => r.id)).toEqual(['r1'])
      expect(taskStore.tasks[0]!.releaseId).toBe('r1')
    })
  })

  describe('releaseRelease', () => {
    async function setup() {
      const store = useReleaseStore()
      const taskStore = useTaskStore()
      await load(store, 'proj-a', [
        makeRelease({ id: 'r1', order: 0 }),
        makeRelease({ id: 'r2', order: 1 }),
      ])
      taskStore.tasks = [
        makeTask({ id: 'open', releaseId: 'r1', completed: false }),
        makeTask({ id: 'done', releaseId: 'r1', completed: true }),
        makeTask({ id: 'other', releaseId: 'r2', completed: false }),
        makeTask({ id: 'free', releaseId: null, completed: false }),
      ]
      return { store, taskStore }
    }

    function releaseIds(taskStore: ReturnType<typeof useTaskStore>) {
      return Object.fromEntries(taskStore.tasks.map(t => [t.id, t.releaseId]))
    }

    it('с none снимает релиз только с незавершённых задач выпускаемого релиза', async () => {
      const { store, taskStore } = await setup()
      vi.mocked(releasesApi.releaseRelease).mockResolvedValueOnce({
        data: makeRelease({ id: 'r1', status: 'released', releasedAt: '2026-10-18T10:00:00.000Z' }),
      } as any)

      const result = await store.releaseRelease('proj-a', 'r1', 'none')

      expect(releaseIds(taskStore)).toEqual({ open: null, done: 'r1', other: 'r2', free: null })
      expect(releasesApi.releaseRelease).toHaveBeenCalledWith('proj-a', 'r1', { moveTo: 'none' })
      expect(result).toMatchObject({ id: 'r1', status: 'released' })
      expect(store.releasesOf('proj-a').find(r => r.id === 'r1')).toMatchObject({
        status: 'released',
        releasedAt: '2026-10-18T10:00:00.000Z',
      })
      expect(store.plannedReleasesOf('proj-a').map(r => r.id)).toEqual(['r2'])
    })

    it('с id релиза переносит незавершённые задачи в цель', async () => {
      const { store, taskStore } = await setup()
      vi.mocked(releasesApi.releaseRelease).mockResolvedValueOnce({
        data: makeRelease({ id: 'r1', status: 'released' }),
      } as any)

      await store.releaseRelease('proj-a', 'r1', 'r2')

      expect(releaseIds(taskStore)).toEqual({ open: 'r2', done: 'r1', other: 'r2', free: null })
    })

    it('при ошибке API откатывает статус и не меняет задачи', async () => {
      const { store, taskStore } = await setup()
      vi.mocked(releasesApi.releaseRelease).mockRejectedValueOnce(new Error('boom'))

      await expect(store.releaseRelease('proj-a', 'r1', 'none')).rejects.toThrow('boom')

      expect(releaseIds(taskStore)).toEqual({ open: 'r1', done: 'r1', other: 'r2', free: null })
      expect(store.releasesOf('proj-a').find(r => r.id === 'r1')!.status).toBe('planned')
    })
  })

  it('сообщает об ошибке перечитывания после успешного сохранения истории', async () => {
    vi.mocked(groupsApi.setGroupRelease).mockResolvedValue({ data: { updated: 0 } } as any)
    vi.mocked(groupsApi.fetchGroups).mockRejectedValue(new Error('network'))
    vi.spyOn(useTaskStore(), 'fetchTasks').mockResolvedValue()
    await expect(useReleaseStore().setStoryRelease('proj-a', 'story', 'r1')).rejects.toThrow('Изменения сохранены')
  })

  it('назначение релиза пустой истории сохраняется через API и обновляет дерево и задачи', async () => {
    const store = useReleaseStore()
    vi.mocked(groupsApi.setGroupRelease).mockResolvedValue({ data: { updated: 0 } } as any)
    const tasks = vi.spyOn(useTaskStore(), 'fetchTasks').mockResolvedValue()
    const groups = vi.spyOn(useGroupStore(), 'fetchGroups')
    expect(await store.setStoryRelease('proj-a', 'story', 'r1')).toBe(0)
    expect(groupsApi.setGroupRelease).toHaveBeenCalledWith('proj-a', 'story', 'r1')
    expect(groups).toHaveBeenCalledWith('proj-a')
    expect(tasks).toHaveBeenCalledOnce()
  })

  describe('assignGroup', () => {
    it('после успеха API перечитывает задачи', async () => {
      const store = useReleaseStore()
      const taskStore = useTaskStore()
      const fetchTasks = vi.spyOn(taskStore, 'fetchTasks').mockResolvedValue()
      vi.mocked(releasesApi.assignGroupToRelease).mockResolvedValueOnce({ data: { updated: 3 } } as any)

      const updated = await store.assignGroup('proj-a', 'r1', 'g1')

      expect(releasesApi.assignGroupToRelease).toHaveBeenCalledWith('proj-a', 'r1', { groupId: 'g1' })
      expect(fetchTasks).toHaveBeenCalledTimes(1)
      expect(updated).toBe(3)
    })

    it('при ошибке API не перечитывает задачи', async () => {
      const store = useReleaseStore()
      const taskStore = useTaskStore()
      const fetchTasks = vi.spyOn(taskStore, 'fetchTasks').mockResolvedValue()
      vi.mocked(releasesApi.assignGroupToRelease).mockRejectedValueOnce(new Error('boom'))

      await expect(store.assignGroup('proj-a', 'r1', 'g1')).rejects.toThrow('boom')

      expect(fetchTasks).not.toHaveBeenCalled()
    })
  })
})
