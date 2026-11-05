import { describe, expect, it, vi } from 'vitest'
import router from '@/router'

vi.mock('@/stores/question-types-store', () => ({ useQuestionTypesStore: () => ({ load: vi.fn().mockResolvedValue(undefined) }) }))
vi.mock('@/api/tokenStorage', () => ({ isAuthenticated: () => true }))

describe('маршрут отдельной страницы группы', () => {
  it('разрешает эпик и историю внутри проекта независимо от задачи и доски', () => {
    const location = router.resolve({ name: 'project-group', params: { projectId: 'project', groupId: 'story' } })
    expect(location.href).toBe('/tasks/project/project/group/story')
    expect(router.resolve(location.href).name).toBe('project-group')
    expect(router.resolve('/tasks/project/project').name).toBe('tasks-project')
    expect(router.resolve('/tasks/task-id').name).toBe('task')
  })
})
