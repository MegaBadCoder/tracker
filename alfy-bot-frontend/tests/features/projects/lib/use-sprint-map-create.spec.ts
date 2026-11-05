import type { BoardGroup } from '@/features/projects/model/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'
import * as groupsApi from '@/features/projects/api/groups-api'
import { useSprintMapCreate } from '@/features/projects/lib/use-sprint-map-create'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useTaskStore } from '@/features/tasks/model/task-store'

vi.mock('@/features/projects/api/groups-api', () => ({ setGroupSprint: vi.fn() }))
const base = { projectId: 'project', sprintId: 'selected', parentId: 'parent', releaseId: null }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  vi.mocked(groupsApi.setGroupSprint).mockResolvedValue({ data: { updated: 0 } } as any)
})

it('назначает новой задаче именно выбранный спринт и явно переданный релиз', async () => {
  const create = vi.spyOn(useTaskStore(), 'createTask').mockResolvedValue({ id: 'task', title: 'Задача', completed: false })
  const session = useSprintMapCreate({ ...base, kind: 'task' }, () => false)
  expect(await session.submit(' Задача ')).toBe('task')
  expect(create).toHaveBeenCalledWith({ title: 'Задача', completed: false, projectId: 'project', sprintId: 'selected', groupId: 'parent', releaseId: null })
})

it('повторяет только назначение спринта после частичного создания эпика и истории', async () => {
  const create = vi.spyOn(useGroupStore(), 'createGroup')
    .mockResolvedValueOnce({ id: 'epic' } as BoardGroup)
    .mockResolvedValueOnce({ id: 'story' } as BoardGroup)
  vi.mocked(groupsApi.setGroupSprint).mockRejectedValueOnce(new Error('Нет сети'))
  const session = useSprintMapCreate({ ...base, kind: 'epic', parentId: null }, () => false)
  expect(await session.submit('Эпик', 'История')).toBeNull()
  expect(session.epicId.value).toBe('epic')
  expect(session.storyId.value).toBe('story')
  expect(session.error.value).toContain('Нет сети')
  expect(await session.submit('Эпик', 'История')).toBe('story')
  expect(create).toHaveBeenCalledTimes(2)
  expect(groupsApi.setGroupSprint).toHaveBeenLastCalledWith('project', 'story', 'selected')
})

it('не создаёт повторный эпик после отказа создания первой истории', async () => {
  const create = vi.spyOn(useGroupStore(), 'createGroup')
    .mockResolvedValueOnce({ id: 'epic' } as BoardGroup)
    .mockRejectedValueOnce(new Error('Ошибка истории'))
    .mockResolvedValueOnce({ id: 'story' } as BoardGroup)
  const session = useSprintMapCreate({ ...base, kind: 'epic', parentId: null }, () => false)
  await session.submit('Эпик', 'История')
  await session.submit('Эпик', 'Исправленная история')
  expect(create).toHaveBeenCalledTimes(3)
  expect(create).toHaveBeenLastCalledWith('project', { title: 'Исправленная история', parentId: 'epic' })
})

it('не запускает два сохранения и запрещает создание в закрытом спринте', async () => {
  let resolve!: (value: any) => void
  const create = vi.spyOn(useTaskStore(), 'createTask').mockImplementation(() => new Promise((done) => {
    resolve = done
  }))
  let closed = false
  const session = useSprintMapCreate({ ...base, kind: 'task' }, () => closed)
  const first = session.submit('Задача')
  expect(session.pending.value).toBe(true)
  await session.submit('Дубль')
  expect(create).toHaveBeenCalledTimes(1)
  resolve({ id: 'task' })
  await first
  closed = true
  await session.submit('Закрытая')
  expect(create).toHaveBeenCalledTimes(1)
  expect(session.error.value).toContain('закрыт')
})

it('не создаёт эпик без первой истории', async () => {
  const create = vi.spyOn(useGroupStore(), 'createGroup')
  const session = useSprintMapCreate({ ...base, kind: 'epic' }, () => false)
  expect(await session.submit('Эпик', ' ')).toBeNull()
  expect(create).not.toHaveBeenCalled()
})
