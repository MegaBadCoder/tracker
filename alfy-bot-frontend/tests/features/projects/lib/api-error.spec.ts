import { describe, expect, it } from 'vitest'
import { apiErrorMessage } from '@/features/projects/lib/api-error'

describe('apiErrorMessage', () => {
  it('берёт строковое сообщение сервера', () => {
    expect(apiErrorMessage({ response: { data: { message: 'Нельзя' } } }, 'запасной')).toBe('Нельзя')
  })

  it('склеивает массив сообщений валидации', () => {
    expect(apiErrorMessage({ response: { data: { message: ['a', 'b'] } } }, 'запасной')).toBe('a; b')
  })

  it('без ответа сервера берёт message ошибки', () => {
    expect(apiErrorMessage(new Error('Network Error'), 'запасной')).toBe('Network Error')
  })

  it('для неизвестного значения возвращает переданный текст', () => {
    expect(apiErrorMessage(null, 'запасной')).toBe('запасной')
  })
})
