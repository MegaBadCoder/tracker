import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { getToken } from '@/api/tokenStorage'
import { useSse } from '@/composables/useSse'

vi.mock('@/api/tokenStorage', () => ({
  getToken: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: { defaults: { baseURL: 'http://localhost:3002/api' } },
}))

function sseStream(chunks: string[], hang = true): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      if (!hang)
        controller.close()
    },
  })
}

describe('useSse', () => {
  let wrapper: VueWrapper | null = null
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.mocked(getToken).mockReturnValue('jwt-token')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.unstubAllGlobals()
  })

  function mountSse(onEvent: (event: string, data: unknown) => void) {
    wrapper = mount(defineComponent({
      setup() {
        useSse('/events', onEvent)
        return () => null
      },
    }))
    return wrapper
  }

  it('не коннектится без токена', async () => {
    vi.mocked(getToken).mockReturnValue(null)
    mountSse(vi.fn())
    await Promise.resolve()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('шлёт Bearer и парсит timer.updated', async () => {
    const onEvent = vi.fn()
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseStream(['event: timer.updated\ndata: {}\n\n']),
    })

    mountSse(onEvent)
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledWith('timer.updated', {}))

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3002/api/events',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-token',
          Accept: 'text/event-stream',
        }),
      }),
    )
  })

  it('не вызывает handler на ping', async () => {
    const onEvent = vi.fn()
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: sseStream(['event: ping\ndata: {}\n\n', 'event: timer.updated\ndata: {}\n\n']),
    })

    mountSse((event, data) => {
      if (event === 'ping')
        return
      onEvent(event, data)
    })
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledWith('timer.updated', {}))
    expect(onEvent).toHaveBeenCalledTimes(1)
  })

  it('не ретраит 401', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, body: null })
    mountSse(vi.fn())
    await Promise.resolve()
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
