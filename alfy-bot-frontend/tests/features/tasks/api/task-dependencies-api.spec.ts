import { beforeEach, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { fetchTaskDependencies, setTaskDependencies } from '@/features/tasks/api/task-dependencies-api'

vi.mock('@/api/client', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
beforeEach(() => vi.resetAllMocks())

it('читает граф отдельным GET без изменения задачи', async () => {
  const response = { data: [{ taskId: 'dependent', dependencyId: 'predecessor' }] }
  vi.mocked(api.get).mockResolvedValue(response)
  expect(await fetchTaskDependencies()).toBe(response)
  expect(api.get).toHaveBeenCalledWith('/tasks/dependencies/graph')
  expect(api.put).not.toHaveBeenCalled()
})

it('передаёт весь набор и возвращает канонический ответ отдельного PUT', async () => {
  const response = { data: { taskId: 'a/b', dependencyIds: ['c'] } }
  vi.mocked(api.put).mockResolvedValue(response)
  expect(await setTaskDependencies('a/b', ['c'])).toBe(response)
  expect(api.put).toHaveBeenCalledWith('/tasks/a%2Fb/dependencies', { dependencyIds: ['c'] })
})
