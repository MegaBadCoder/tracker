import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { fetchGoals } from '@/api/goals'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('fetchGoals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('без опций отправляет GET /goals без params', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    await fetchGoals()
    expect(api.get).toHaveBeenCalledWith('/goals', { params: undefined })
  })

  it('со scope отправляет GET /goals с params { scope }', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    await fetchGoals({ scope: 'global' })
    expect(api.get).toHaveBeenCalledWith('/goals', { params: { scope: 'global' } })
  })

  it('со status отправляет GET /goals с params { status }', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    await fetchGoals({ status: 'active' })
    expect(api.get).toHaveBeenCalledWith('/goals', { params: { status: 'active' } })
  })

  it('со status и scope отправляет оба в params', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    await fetchGoals({ status: 'active', scope: 'regular' })
    expect(api.get).toHaveBeenCalledWith('/goals', {
      params: { status: 'active', scope: 'regular' },
    })
  })

  it('пробрасывает ошибку при сбое сети', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network Error'))
    await expect(fetchGoals({ scope: 'all' })).rejects.toThrow('Network Error')
  })
})
