import { expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { removeGroupFromSprint } from '@/features/projects/api/sprints-api'

vi.mock('@/api/client', () => ({ api: { post: vi.fn() } }))

it('возврат группы отправляет один POST с исходным спринтом без тела', async () => {
  vi.mocked(api.post).mockResolvedValueOnce({ data: { updated: 4 } })
  const response = await removeGroupFromSprint('project', 'sprint', 'group')
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/projects/project/sprints/sprint/groups/group/backlog')
  expect(response.data.updated).toBe(4)
})
