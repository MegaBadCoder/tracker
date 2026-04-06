import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '@/api/client'
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
} from '@/features/projects/api/projects-api'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

describe('projects API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchProjects отправляет GET /projects', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    await fetchProjects()
    expect(api.get).toHaveBeenCalledWith('/projects')
  })

  it('createProject ��тправляет POST /projects с payload', async () => {
    const payload = { title: 'Новый проект' }
    vi.mocked(api.post).mockResolvedValue({ data: { id: '1', ...payload } })
    await createProject(payload)
    expect(api.post).toHaveBeenCalledWith('/projects', payload)
  })

  it('updateProject отправляет PATCH /projects/:id', async () => {
    const data = { title: 'Обновлённый' }
    vi.mocked(api.patch).mockResolvedValue({ data: { id: '1', ...data } })
    await updateProject('1', data)
    expect(api.patch).toHaveBeenCalledWith('/projects/1', data)
  })

  it('deleteProject отправляет DELETE /projects/:id', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: undefined })
    await deleteProject('1')
    expect(api.delete).toHaveBeenCalledWith('/projects/1')
  })

  it('createProject пробрасывает ошибку при сбое сети', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Network Error'))
    await expect(createProject({ title: 'X' })).rejects.toThrow('Network Error')
  })

  it('fetchProjects пробрасывает ошибку при 500', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Internal Server Error'))
    await expect(fetchProjects()).rejects.toThrow('Internal Server Error')
  })
})
