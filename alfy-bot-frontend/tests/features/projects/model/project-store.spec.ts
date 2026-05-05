import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '@/features/projects/model/project-store'
import { api } from '@/api/client'
import type { Project } from '@/features/projects/model/types'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    parentId: null,
    title: 'Проект',
    description: null,
    viewMode: 'list',
    icon: null,
    color: null,
    order: 0,
    ...overrides,
  }
}

describe('useProjectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // ── fetchProjects ───────────────────────────────────────────────

  describe('fetchProjects', () => {
    it('загружает и сохраняет список проектов', async () => {
      const projects = [makeProject(), makeProject({ id: 'proj-2', title: 'Второй' })]
      vi.mocked(api.get).mockResolvedValue({ data: projects })

      const store = useProjectStore()
      await store.fetchProjects()

      expect(store.projects).toHaveLength(2)
      expect(api.get).toHaveBeenCalledWith('/projects')
    })

    it('устанавливает loading в true во время загрузки', async () => {
      vi.mocked(api.get).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: [] }), 100)),
      )

      const store = useProjectStore()
      const promise = store.fetchProjects()

      expect(store.loading).toBe(true)
      await promise
      expect(store.loading).toBe(false)
    })

    it('устанавливает error при ошибке API', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Ошибка сети'))

      const store = useProjectStore()
      await store.fetchProjects()

      expect(store.error).toBe('Ошибка сети')
    })

    it('сбрасывает loading после ошибки', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Ошибка'))

      const store = useProjectStore()
      await store.fetchProjects()

      expect(store.loading).toBe(false)
    })
  })

  // ── projectTree ──��──────────────────────────────────────────────

  describe('projectTree', () => {
    it('вычисляет дерево из плоского списка', async () => {
      const projects = [
        makeProject({ id: 'root' }),
        makeProject({ id: 'child', parentId: 'root' }),
      ]
      vi.mocked(api.get).mockResolvedValue({ data: projects })

      const store = useProjectStore()
      await store.fetchProjects()

      expect(store.projectTree).toHaveLength(1)
      expect(store.projectTree[0].children).toHaveLength(1)
    })

    it('обновляется при изменении projects', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: [makeProject()] })

      const store = useProjectStore()
      await store.fetchProjects()

      expect(store.projectTree).toHaveLength(1)

      store.projects.push(makeProject({ id: 'proj-2' }))

      expect(store.projectTree).toHaveLength(2)
    })
  })

  // ── projectMap ───────────���──────────────────────────────────────

  describe('projectMap', () => {
    it('содержит все проекты по id', async () => {
      const projects = [
        makeProject({ id: 'a' }),
        makeProject({ id: 'b' }),
      ]
      vi.mocked(api.get).mockResolvedValue({ data: projects })

      const store = useProjectStore()
      await store.fetchProjects()

      expect(store.projectMap.get('a')).toBeDefined()
      expect(store.projectMap.get('b')).toBeDefined()
    })

    it('возвращает undefined для несуществующего id', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: [] })

      const store = useProjectStore()
      await store.fetchProjects()

      expect(store.projectMap.get('nonexistent')).toBeUndefined()
    })
  })

  // ── createProject ───────���─────────────────────────────���─────────

  describe('createProject', () => {
    it('добавляет optimistic проект в список', async () => {
      vi.mocked(api.post).mockImplementation(
        () => new Promise((resolve) =>
          setTimeout(() => resolve({ data: makeProject({ id: 'real-id' }) }), 100),
        ),
      )

      const store = useProjectStore()
      const promise = store.createProject({ title: 'Новый' })

      // Optimistic: temp project added
      expect(store.projects).toHaveLength(1)
      expect(store.projects[0].id).toMatch(/^temp-/)

      await promise
    })

    it('заменяет temp проект на реальный после ответа', async () => {
      const realProject = makeProject({ id: 'real-id', title: 'Новый' })
      vi.mocked(api.post).mockResolvedValue({ data: realProject })

      const store = useProjectStore()
      await store.createProject({ title: 'Новый' })

      expect(store.projects).toHaveLength(1)
      expect(store.projects[0].id).toBe('real-id')
    })

    it('откатывает optimistic при ошибке API', async () => {
      vi.mocked(api.post).mockRejectedValue(new Error('Ошибка'))

      const store = useProjectStore()

      await expect(store.createProject({ title: 'X' })).rejects.toThrow()

      expect(store.projects).toHaveLength(0)
    })
  })

  // ── deleteProject ────────���──────────────────────────────────────

  describe('deleteProject', () => {
    it('удаляет проект optimistically', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: [makeProject()] })
      vi.mocked(api.delete).mockResolvedValue({ data: undefined })

      const store = useProjectStore()
      await store.fetchProjects()

      expect(store.projects).toHaveLength(1)

      await store.deleteProject('proj-1')

      expect(store.projects).toHaveLength(0)
    })

    it('откатывает удаление при ошибке API', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: [makeProject()] })
      vi.mocked(api.delete).mockRejectedValue(new Error('Ошибка'))

      const store = useProjectStore()
      await store.fetchProjects()

      await expect(store.deleteProject('proj-1')).rejects.toThrow()

      expect(store.projects).toHaveLength(1)
    })
  })

  // ── updateProject ───────────────────────────────────────────────

  describe('updateProject', () => {
    it('обновляет проект в списке', async () => {
      const project = makeProject()
      vi.mocked(api.get).mockResolvedValue({ data: [project] })
      vi.mocked(api.patch).mockResolvedValue({
        data: { ...project, title: 'Обновлённый' },
      })

      const store = useProjectStore()
      await store.fetchProjects()

      await store.updateProject('proj-1', { title: 'Обновлённый' })

      expect(store.projects[0].title).toBe('Обновлённый')
    })

    it('сохраняет оптимистичное состояние если PATCH вернул пустое тело', async () => {
      const project = makeProject()
      vi.mocked(api.get).mockResolvedValue({ data: [project] })
      vi.mocked(api.patch).mockResolvedValue({ data: {} })

      const store = useProjectStore()
      await store.fetchProjects()

      await store.updateProject('proj-1', { viewMode: 'board' })

      expect(store.projects[0].viewMode).toBe('board')
      expect(store.projects[0].title).toBe('Проект')
    })

    it('откатывает при ошибке API', async () => {
      const project = makeProject()
      vi.mocked(api.get).mockResolvedValue({ data: [project] })
      vi.mocked(api.patch).mockRejectedValue(new Error('Ошибка'))

      const store = useProjectStore()
      await store.fetchProjects()

      await expect(
        store.updateProject('proj-1', { title: 'X' }),
      ).rejects.toThrow()

      expect(store.projects[0].title).toBe('Проект')
    })
  })
})
