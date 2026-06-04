import { describe, expect, it } from 'vitest'

import {
  emojiRatingAnswer,
  numberAnswer,
  ratingAnswer,
  textAnswer,
  timeSpentAnswer,
  yesNoAnswer,
} from '@/features/goals/lib/answer-format'

describe('answer-format — bot-identical answer strings', () => {
  it('ratingAnswer returns the number as a string', () => {
    expect(ratingAnswer(4)).toBe('4')
    expect(ratingAnswer(1)).toBe('1')
    expect(ratingAnswer(5)).toBe('5')
  })

  it('emojiRatingAnswer returns the 1-based index, not the emoji', () => {
    expect(emojiRatingAnswer(3)).toBe('3')
    expect(emojiRatingAnswer(1)).toBe('1')
    expect(emojiRatingAnswer(5)).toBe('5')
  })

  it('yesNoAnswer returns "yes"/"no", not "Да"/"Нет"', () => {
    expect(yesNoAnswer(true)).toBe('yes')
    expect(yesNoAnswer(false)).toBe('no')
  })

  it('timeSpentAnswer returns the label as-is', () => {
    expect(timeSpentAnswer('1-2ч')).toBe('1-2ч')
    expect(timeSpentAnswer('<30 мин')).toBe('<30 мин')
  })

  it('numberAnswer trims the raw input', () => {
    expect(numberAnswer(' 42 ')).toBe('42')
  })

  it('textAnswer trims the raw input', () => {
    expect(textAnswer(' hi ')).toBe('hi')
  })
})
