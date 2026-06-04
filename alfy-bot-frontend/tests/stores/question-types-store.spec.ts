import type { QuestionTypeOption } from '@/api/question-types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchQuestionTypes } from '@/api/question-types'
import { useQuestionTypesStore } from '@/stores/question-types-store'

vi.mock('@/api/question-types')

const mockedFetch = vi.mocked(fetchQuestionTypes)

const SERVER_TYPES: QuestionTypeOption[] = [
  { type: 'text', label: 'Текстовый ввод', example: 'Что сделал сегодня?' },
  { type: 'rating', label: 'Оценка (числа)', example: 'Оцени продуктивность (1-5)', options: [1, 2, 3, 4, 5] },
  { type: 'emoji_rating', label: 'Оценка (смайлики)', example: 'Как прошёл день?', options: ['😕', '😐', '🙂', '😊', '🔥'] },
  { type: 'yes_no', label: 'Да/Нет', example: 'Выполнил запланированное?', options: ['Да', 'Нет'] },
]

describe('question-types store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockedFetch.mockReset()
    mockedFetch.mockResolvedValue(SERVER_TYPES)
  })

  it('load is idempotent — two calls fetch once', async () => {
    const store = useQuestionTypesStore()
    await store.load()
    await store.load()
    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })

  it('options() returns the emoji array after load', async () => {
    const store = useQuestionTypesStore()
    await store.load()
    expect(store.options('emoji_rating')).toEqual(['😕', '😐', '🙂', '😊', '🔥'])
  })

  it('label() returns the server label after load', async () => {
    const store = useQuestionTypesStore()
    await store.load()
    expect(store.label('text')).toBe('Текстовый ввод')
  })

  it('options() returns [] before load (fallback)', () => {
    const store = useQuestionTypesStore()
    expect(store.options('emoji_rating')).toEqual([])
  })

  it('label() falls back to the key before load', () => {
    const store = useQuestionTypesStore()
    expect(store.label('text')).toBe('text')
  })

  it('load propagates fetch errors and does not mark loaded', async () => {
    const store = useQuestionTypesStore()
    mockedFetch.mockRejectedValueOnce(new Error('boom'))
    await expect(store.load()).rejects.toThrow('boom')
    expect(store.loaded).toBe(false)
  })
})
