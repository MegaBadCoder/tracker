import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { api } from '@/api/client'

function stubLocation(pathname: string, hrefSetter: (v: string) => void) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      pathname,
      search: '?mode=full',
      hash: '#description',
      set href(v: string) {
        hrefSetter(v)
      },
      get href() {
        return ''
      },
    },
  })
}

describe('api client 401 interceptor', () => {
  const originalLocation = window.location

  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(), removeItem: vi.fn() })
    api.defaults.adapter = async () => {
      const error: any = new Error('Unauthorized')
      error.response = { status: 401, data: {}, headers: {}, config: {}, statusText: 'Unauthorized' }
      throw error
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
    delete (api.defaults as { adapter?: unknown }).adapter
  })

  it('preserves the requested task on expired authentication', async () => {
    const hrefSetter = vi.fn()
    stubLocation('/tasks/task-id', hrefSetter)
    await expect(api.get('/tasks/task-id')).rejects.toBeDefined()
    expect(hrefSetter).toHaveBeenCalledWith('/login?redirect=%2Ftasks%2Ftask-id%3Fmode%3Dfull%23description')
  })

  it('does NOT redirect to /login when already on /login (prevents reload loop)', async () => {
    const hrefSetter = vi.fn()
    stubLocation('/login', hrefSetter)

    await expect(api.get('/push/vapid-key')).rejects.toBeDefined()
    expect(hrefSetter).not.toHaveBeenCalled()
  })
})
