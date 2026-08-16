import { describe, expect, it } from 'vitest'
import { countFromDurationMinutes, computePomodoroTotalMinutes } from './duration'

describe('countFromDurationMinutes', () => {
  it('без duration → 4 раунда (дефолт)', () => {
    expect(countFromDurationMinutes(computePomodoroTotalMinutes(4))).toBe(4)
  })

  it('60 минут → 2×25 (55 ближе, чем 1×25 или 3×25)', () => {
    expect(countFromDurationMinutes(60)).toBe(2)
  })

  it('25 минут → 1 раунд', () => {
    expect(countFromDurationMinutes(25)).toBe(1)
  })
})
