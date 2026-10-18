import { describe, expect, it } from 'vitest'
import { safeAuthRedirect } from '@/lib/auth-redirect'

describe('safeAuthRedirect', () => {
  it('preserves local task URL including query/hash', () => {
    expect(safeAuthRedirect('/tasks/abc?view=full#description')).toBe('/tasks/abc?view=full#description')
  })
  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/%5cevil.test', '/login', '/verify-email', '/reset-password', 'javascript:alert(1)', ['/tasks/abc'], undefined, '/tasks/../login', '/tasks\n/abc'])('rejects unsafe destination %s', (value) => {
    expect(safeAuthRedirect(value)).toBe('/')
  })
})
