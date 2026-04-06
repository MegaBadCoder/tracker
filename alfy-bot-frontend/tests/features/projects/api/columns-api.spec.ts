import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '@/api/client'
import {
  fetchColumns,
  createColumn,
  updateColumn,
  deleteColumn,
  reorderColumns,
} from '@/features/projects/api/columns-api'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('columns API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchColumns отправляет GET /projects/:id/columns', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    await fetchColumns('proj-1')
    expect(api.get).toHaveBeenCalledWith('/projects/proj-1/columns')
  })

  it('createColumn отправляет POST с payload', async () => {
    const payload = { title: 'В работе' }
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'col-1', ...payload } })
    await createColumn('proj-1', payload)
    expect(api.post).toHaveBeenCalledWith('/projects/proj-1/columns', payload)
  })

  it('updateColumn отправляет PATCH /projects/:id/columns/:colId', async () => {
    const data = { title: 'Готово' }
    vi.mocked(api.patch).mockResolvedValue({ data: { id: 'col-1', ...data } })
    await updateColumn('proj-1', 'col-1', data)
    expect(api.patch).toHaveBeenCalledWith('/projects/proj-1/columns/col-1', data)
  })

  it('deleteColumn отправляет DELETE', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: undefined })
    await deleteColumn('proj-1', 'col-1')
    expect(api.delete).toHaveBeenCalledWith('/projects/proj-1/columns/col-1')
  })

  it('reorderColumns отправляет PATCH с orderedIds', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: undefined })
    await reorderColumns('proj-1', ['col-2', 'col-1'])
    expect(api.patch).toHaveBeenCalledWith('/projects/proj-1/columns/reorder', {
      orderedIds: ['col-2', 'col-1'],
    })
  })

  it('fetchColumns пробрасывает ошибку при 500', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Internal Server Error'))
    await expect(fetchColumns('proj-1')).rejects.toThrow('Internal Server Error')
  })

  it('createColumn пробрасывает ошибку при сбое сети', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Network Error'))
    await expect(createColumn('proj-1', { title: 'X' })).rejects.toThrow('Network Error')
  })
})
