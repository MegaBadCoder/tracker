import type { BoardGroup, BoardGroupNode } from '@/features/projects/model/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as groupsApi from '@/features/projects/api/groups-api'
import { useGroupStore } from '@/features/projects/model/group-store'

vi.mock('@/features/projects/api/groups-api', () => ({
  fetchGroups: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  reorderGroups: vi.fn(),
}))

function makeGroup(overrides: Partial<BoardGroupNode> = {}): BoardGroupNode {
  return {
    id: 'epic-1',
    projectId: 'proj-a',
    parentId: null,
    type: 'epic',
    title: 'Эпик',
    description: null,
    status: 'open',
    completedAt: null,
    color: null,
    startDate: null,
    dueDate: null,
    order: 0,
    children: [],
    ...overrides,
  }
}

describe('useGroupStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('загрузка проекта B не меняет groupsOf(A)', async () => {
    const store = useGroupStore()
    const epicA = makeGroup({ id: 'epic-a', projectId: 'proj-a' })
    const epicB = makeGroup({ id: 'epic-b', projectId: 'proj-b' })

    vi.mocked(groupsApi.fetchGroups).mockResolvedValueOnce({ data: [epicA] } as any)
    await store.fetchGroups('proj-a')

    vi.mocked(groupsApi.fetchGroups).mockResolvedValueOnce({ data: [epicB] } as any)
    await store.fetchGroups('proj-b')

    expect(store.groupsOf('proj-a')).toEqual([epicA])
    expect(store.groupsOf('proj-b')).toEqual([epicB])
  })

  it('groupsOf для непрогруженного проекта возвращает пустой массив', () => {
    const store = useGroupStore()
    expect(store.groupsOf('unknown')).toEqual([])
  })

  it('createGroup меняет только дерево своего проекта', async () => {
    const store = useGroupStore()
    vi.mocked(groupsApi.fetchGroups).mockResolvedValueOnce({ data: [] } as any)
    await store.fetchGroups('proj-a')
    vi.mocked(groupsApi.fetchGroups).mockResolvedValueOnce({ data: [] } as any)
    await store.fetchGroups('proj-b')

    vi.mocked(groupsApi.createGroup).mockResolvedValueOnce({
      data: makeGroup({ id: 'epic-new', projectId: 'proj-a' }),
    } as any)
    await store.createGroup('proj-a', { title: 'Новый эпик' })

    expect(store.groupsOf('proj-a')).toHaveLength(1)
    expect(store.groupsOf('proj-b')).toHaveLength(0)
  })

  it('updateGroup меняет только дерево своего проекта', async () => {
    const store = useGroupStore()
    const epicA = makeGroup({ id: 'epic-a', projectId: 'proj-a', title: 'Старое' })
    const epicB = makeGroup({ id: 'epic-b', projectId: 'proj-b', title: 'Другой проект' })
    vi.mocked(groupsApi.fetchGroups).mockResolvedValueOnce({ data: [epicA] } as any)
    await store.fetchGroups('proj-a')
    vi.mocked(groupsApi.fetchGroups).mockResolvedValueOnce({ data: [epicB] } as any)
    await store.fetchGroups('proj-b')

    vi.mocked(groupsApi.updateGroup).mockResolvedValueOnce({
      data: { ...epicA, title: 'Новое' },
    } as any)
    await store.updateGroup('proj-a', 'epic-a', { title: 'Новое' })

    expect(store.groupsOf('proj-a')[0]?.title).toBe('Новое')
    expect(store.groupsOf('proj-b')[0]?.title).toBe('Другой проект')
  })

  it('deleteGroup меняет только дерево своего проекта', async () => {
    const store = useGroupStore()
    const epicA = makeGroup({ id: 'epic-a', projectId: 'proj-a' })
    const epicB = makeGroup({ id: 'epic-b', projectId: 'proj-b' })
    vi.mocked(groupsApi.fetchGroups).mockResolvedValueOnce({ data: [epicA] } as any)
    await store.fetchGroups('proj-a')
    vi.mocked(groupsApi.fetchGroups).mockResolvedValueOnce({ data: [epicB] } as any)
    await store.fetchGroups('proj-b')

    vi.mocked(groupsApi.deleteGroup).mockResolvedValueOnce({} as any)
    await store.deleteGroup('proj-a', 'epic-a')

    expect(store.groupsOf('proj-a')).toEqual([])
    expect(store.groupsOf('proj-b')).toEqual([epicB])
  })

  it('откатывает оптимистичное обновление при ошибке API', async () => {
    const store = useGroupStore()
    const epicA = makeGroup({ id: 'epic-a', projectId: 'proj-a', title: 'Старое' })
    vi.mocked(groupsApi.fetchGroups).mockResolvedValueOnce({ data: [epicA] } as any)
    await store.fetchGroups('proj-a')

    vi.mocked(groupsApi.updateGroup).mockRejectedValueOnce(new Error('boom'))
    await expect(store.updateGroup('proj-a', 'epic-a', { title: 'Новое' })).rejects.toThrow('boom')

    expect(store.groupsOf('proj-a')[0]?.title).toBe('Старое')
  })

  it('ensureGroups не грузит проект повторно, если он уже загружен', async () => {
    const store = useGroupStore()
    vi.mocked(groupsApi.fetchGroups).mockResolvedValue({ data: [] } as any)

    await store.ensureGroups('proj-a')
    await store.ensureGroups('proj-a')

    expect(groupsApi.fetchGroups).toHaveBeenCalledTimes(1)
  })

  it('isLoading отражает состояние конкретного проекта во время загрузки', async () => {
    const store = useGroupStore()
    let resolveFetch: (value: { data: BoardGroupNode[] }) => void
    vi.mocked(groupsApi.fetchGroups).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve
      }) as any,
    )

    const promise = store.fetchGroups('proj-a')
    expect(store.isLoading('proj-a')).toBe(true)
    expect(store.isLoading('proj-b')).toBe(false)

    resolveFetch!({ data: [] })
    await promise

    expect(store.isLoading('proj-a')).toBe(false)
  })

  it('toggleGroupDone переключает статус истории', async () => {
    const store = useGroupStore()
    const story = makeGroup({ id: 'story-1', projectId: 'proj-a', type: 'story', parentId: 'epic-1', status: 'open' })
    const epic = makeGroup({ id: 'epic-1', projectId: 'proj-a', children: [story] })
    vi.mocked(groupsApi.fetchGroups).mockResolvedValueOnce({ data: [epic] } as any)
    await store.fetchGroups('proj-a')

    vi.mocked(groupsApi.updateGroup).mockResolvedValueOnce({
      data: { ...story, status: 'done' },
    } as any)
    await store.toggleGroupDone('proj-a', story as BoardGroup)

    expect(groupsApi.updateGroup).toHaveBeenCalledWith('proj-a', 'story-1', { status: 'done' })
    expect(store.groupsOf('proj-a')[0]?.children[0]?.status).toBe('done')
  })
})
