import { describe, expect, it } from 'vitest'
import { newQuestionDraft } from '@/features/goals/lib/new-question'

describe('newQuestionDraft', () => {
  it('возвращает дефолт пустого вопроса', () => {
    expect(newQuestionDraft()).toEqual({
      question: '',
      type: 'text',
      canSkip: false,
      scheduleType: 'daily',
    })
  })

  it('возвращает НОВЫЙ объект на каждый вызов (не shared ref)', () => {
    const a = newQuestionDraft()
    const b = newQuestionDraft()
    expect(a).not.toBe(b)
    a.question = 'changed'
    expect(b.question).toBe('')
  })
})
