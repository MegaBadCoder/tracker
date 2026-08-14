import { describe, expect, it } from 'vitest'
import { isDateInRange, pickDayViewDate } from './week'

const local = (y: number, m: number, d: number) => new Date(y, m - 1, d)

describe('pickDayViewDate', () => {
  const range = {
    start: local(2026, 8, 10),
    end: local(2026, 8, 16),
  }

  it('берёт сегодня, если сегодня в видимом диапазоне недели', () => {
    expect(pickDayViewDate(range, local(2026, 8, 14))).toEqual(local(2026, 8, 14))
  })

  it('не берёт середину вьюпорта — только сегодня или левый край', () => {
    const picked = pickDayViewDate(range, local(2026, 8, 10))
    expect(picked).toEqual(local(2026, 8, 10))
    expect(picked).not.toEqual(local(2026, 8, 13))
  })

  it('если сегодня вне диапазона — левый край видимой недели', () => {
    expect(pickDayViewDate(range, local(2026, 8, 20))).toEqual(local(2026, 8, 10))
  })
})

describe('isDateInRange', () => {
  it('включает границы по календарному дню, игнорируя время', () => {
    const start = new Date(2026, 7, 10, 0, 0)
    const end = new Date(2026, 7, 16, 18, 30)
    expect(isDateInRange(new Date(2026, 7, 10, 23, 0), start, end)).toBe(true)
    expect(isDateInRange(new Date(2026, 7, 16, 9, 0), start, end)).toBe(true)
    expect(isDateInRange(new Date(2026, 7, 9, 23, 0), start, end)).toBe(false)
    expect(isDateInRange(new Date(2026, 7, 17, 0, 0), start, end)).toBe(false)
  })
})
