import { describe, expect, it } from 'vitest'
import { formatTaskCount } from '@/features/tasks/lib/formatters'

describe('formatTaskCount', () => {
  it('единственное число', () => {
    expect(formatTaskCount(1)).toBe('1 задача')
    expect(formatTaskCount(21)).toBe('21 задача')
  })

  it('форма для 2-4', () => {
    expect(formatTaskCount(2)).toBe('2 задачи')
    expect(formatTaskCount(4)).toBe('4 задачи')
    expect(formatTaskCount(33)).toBe('33 задачи')
  })

  it('форма родительного падежа', () => {
    expect(formatTaskCount(0)).toBe('0 задач')
    expect(formatTaskCount(5)).toBe('5 задач')
    expect(formatTaskCount(100)).toBe('100 задач')
  })

  it('подростковые числа — исключение из правила', () => {
    expect(formatTaskCount(11)).toBe('11 задач')
    expect(formatTaskCount(12)).toBe('12 задач')
    expect(formatTaskCount(14)).toBe('14 задач')
    expect(formatTaskCount(111)).toBe('111 задач')
  })
})
