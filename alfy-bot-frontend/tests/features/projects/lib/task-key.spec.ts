import { describe, expect, it } from 'vitest'
import { isObviouslyInvalidTaskKeyPrefix, taskKey } from '@/features/projects/lib/task-key'

describe('taskKey', () => {
  it('собирает ключ у agile-проекта с префиксом и номером', () => {
    expect(taskKey({ type: 'agile', taskKeyPrefix: 'ALF' }, { number: 12 })).toBe('ALF-12')
  })

  it('возвращает null без префикса', () => {
    expect(taskKey({ type: 'agile', taskKeyPrefix: null }, { number: 12 })).toBeNull()
  })

  it('возвращает null без номера', () => {
    expect(taskKey({ type: 'agile', taskKeyPrefix: 'ALF' }, { number: null })).toBeNull()
    expect(taskKey({ type: 'agile', taskKeyPrefix: 'ALF' }, {})).toBeNull()
  })

  it('возвращает null у обычного проекта', () => {
    expect(taskKey({ type: 'simple', taskKeyPrefix: 'ALF' }, { number: 3 })).toBeNull()
  })

  it('возвращает null без проекта', () => {
    expect(taskKey(undefined, { number: 3 })).toBeNull()
  })

  it('поддерживает номер 0 как валидный', () => {
    expect(taskKey({ type: 'agile', taskKeyPrefix: 'ALF' }, { number: 0 })).toBe('ALF-0')
  })
})

describe('isObviouslyInvalidTaskKeyPrefix', () => {
  it('пустое значение и допустимые префиксы не считаются заведомо неверными', () => {
    expect(isObviouslyInvalidTaskKeyPrefix('')).toBe(false)
    expect(isObviouslyInvalidTaskKeyPrefix('ALF')).toBe(false)
    expect(isObviouslyInvalidTaskKeyPrefix('A1')).toBe(false)
    expect(isObviouslyInvalidTaskKeyPrefix('ABCDEFGHIJ')).toBe(false)
  })

  it('нелатинские символы, пробелы и длина больше 10 — заведомо неверны', () => {
    expect(isObviouslyInvalidTaskKeyPrefix('АЛФ')).toBe(true)
    expect(isObviouslyInvalidTaskKeyPrefix('AL F')).toBe(true)
    expect(isObviouslyInvalidTaskKeyPrefix('A-B')).toBe(true)
    expect(isObviouslyInvalidTaskKeyPrefix('ABCDEFGHIJK')).toBe(true)
  })

  it('формат «начинается с буквы» оставляет серверу', () => {
    expect(isObviouslyInvalidTaskKeyPrefix('1AB')).toBe(false)
  })
})
