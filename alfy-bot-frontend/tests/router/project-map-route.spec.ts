import { expect, it, vi } from 'vitest'
import router from '@/router'

vi.mock('@/stores/question-types-store', () => ({ useQuestionTypesStore: () => ({ load: vi.fn().mockResolvedValue(undefined) }) }))
vi.mock('@/api/tokenStorage', () => ({ isAuthenticated: () => true }))

it('карта имеет собственную ссылку на проект и выбранный спринт', () => {
  const location = router.resolve({ name: 'tasks-project-map', params: { projectId: 'project' }, query: { sprint: 'selected' } })
  expect(location.href).toBe('/tasks/project/project/map?sprint=selected')
  expect(router.resolve(location.href).name).toBe('tasks-project-map')
})
