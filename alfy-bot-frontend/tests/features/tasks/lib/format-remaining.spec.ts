import { describe, expect, it } from 'vitest'
import { formatRemaining } from '@/features/tasks/lib/formatters'

describe('formatRemaining', () => {
  it('меньше часа — только минуты', () => {
    expect(formatRemaining(45)).toBe('45 мин')
  })

  it('ровные часы — без минут', () => {
    expect(formatRemaining(120)).toBe('2 ч')
  })

  it('часы с минутами', () => {
    expect(formatRemaining(192)).toBe('3 ч 12 мин')
  })

  it('меньше минуты не показывает ноль', () => {
    expect(formatRemaining(0)).toBe('меньше минуты')
  })
})
