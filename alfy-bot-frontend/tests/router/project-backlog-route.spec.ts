import { describe, expect, it, vi } from 'vitest'

vi.mock('@/stores/question-types-store', () => ({
  useQuestionTypesStore: () => ({ load: vi.fn().mockResolvedValue(undefined) }),
}))

vi.mock('@/api/tokenStorage', () => ({
  isAuthenticated: () => true,
}))

// eslint-disable-next-line import/first -- router-импорт после vi.mock намеренно
import router from '@/router'

describe('маршрут бэклога проекта', () => {
  it('tasks-project-backlog существует и не пересекается с маршрутом доски', () => {
    const backlog = router.resolve({ name: 'tasks-project-backlog', params: { projectId: 'p1' } })
    const board = router.resolve({ name: 'tasks-project', params: { projectId: 'p1' } })

    expect(backlog.href).toBe(`${board.href}/backlog`)
    expect(backlog.matched.at(-1)?.name).toBe('tasks-project-backlog')
  })

  it('tasks-project-releases существует и не пересекается с другими вкладками', () => {
    const releases = router.resolve({ name: 'tasks-project-releases', params: { projectId: 'p1' } })
    const board = router.resolve({ name: 'tasks-project', params: { projectId: 'p1' } })

    expect(releases.href).toBe(`${board.href}/releases`)
    expect(releases.matched.at(-1)?.name).toBe('tasks-project-releases')
  })
})
