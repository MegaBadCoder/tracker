import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { api } from '@/api/client'

function stubLocation(pathname: string, hrefSetter: (v: string) => void) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      pathname,
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
    api.defaults.adapter = async () => {
      const error: any = new Error('Unauthorized')
      error.response = { status: 401, data: {}, headers: {}, config: {}, statusText: 'Unauthorized' }
      throw error
    }
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
    delete (api.defaults as { adapter?: unknown }).adapter
  })

  it('does NOT redirect to /login when already on /login (prevents reload loop)', async () => {
    const hrefSetter = vi.fn()
    stubLocation('/login', hrefSetter)

    await expect(api.get('/push/vapid-key')).rejects.toBeDefined()
    expect(hrefSetter).not.toHaveBeenCalled()
  })
})
