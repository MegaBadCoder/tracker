import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import {
  fetchGoalReportStatus,
  fetchReportQueue,
  submitAnswer,
  submitPhotoAnswer,
} from '@/api/reports'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('reports API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetchGoalReportStatus → GET /goals/:id/report-status?date', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} })
    await fetchGoalReportStatus(5, '2026-06-01')
    expect(api.get).toHaveBeenCalledWith('/goals/5/report-status', { params: { date: '2026-06-01' } })
  })

  it('fetchReportQueue → GET /goals/reports/queue?date (two-segment, не /goals/report-queue)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    await fetchReportQueue('2026-06-01')
    expect(api.get).toHaveBeenCalledWith('/goals/reports/queue', { params: { date: '2026-06-01' } })
  })

  it('submitAnswer → POST /questions/:id/answers с телом', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true } })
    await submitAnswer(7, '2026-06-01', 'yes')
    expect(api.post).toHaveBeenCalledWith('/questions/7/answers', { scheduled_date: '2026-06-01', answer: 'yes' })
  })

  it('submitPhotoAnswer шлёт FormData и СНИМАЕТ Content-Type (иначе 400 без multipart-boundary)', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true } })
    const file = new File([new Uint8Array([1, 2, 3])], 'x.jpg', { type: 'image/jpeg' })

    await submitPhotoAnswer(7, '2026-06-01', file)

    expect(api.post).toHaveBeenCalledTimes(1)
    const [url, body, config] = vi.mocked(api.post).mock.calls[0]
    expect(url).toBe('/questions/7/answers/photo')
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('photo')).toBe(file)
    expect((body as FormData).get('scheduled_date')).toBe('2026-06-01')
    // регрессия: дефолтный application/json должен быть снят, чтобы браузер
    // выставил multipart/form-data; boundary=… сам.
    expect((config as { headers?: Record<string, unknown> })?.headers?.['Content-Type']).toBeUndefined()
    expect((config as { headers?: object })?.headers).toHaveProperty('Content-Type')
  })
})
