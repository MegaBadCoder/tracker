import { describe, it, expect, beforeEach } from 'vitest'
import { ru, enUS } from 'date-fns/locale'
import {
  normalizeLanguage,
  normalizeFirstDayOfWeek,
  intlLocaleFor,
  setLocalePrefs,
  intlLocale,
  weekStartsOn,
  dateFnsLocale,
  useLocale,
} from '@/composables/useLocale'

describe('useLocale — pure resolvers', () => {
  it('normalizeLanguage: дефолт ru, валидный en, мусор → ru', () => {
    expect(normalizeLanguage(undefined)).toBe('ru')
    expect(normalizeLanguage('')).toBe('ru')
    expect(normalizeLanguage('ru')).toBe('ru')
    expect(normalizeLanguage('en')).toBe('en')
    expect(normalizeLanguage('xx')).toBe('ru')
  })

  it('normalizeFirstDayOfWeek: 0..6 проходят, иначе → 1', () => {
    expect(normalizeFirstDayOfWeek(0)).toBe(0)
    expect(normalizeFirstDayOfWeek(1)).toBe(1)
    expect(normalizeFirstDayOfWeek(6)).toBe(6)
    expect(normalizeFirstDayOfWeek(7)).toBe(1)
    expect(normalizeFirstDayOfWeek(-1)).toBe(1)
    expect(normalizeFirstDayOfWeek(1.5)).toBe(1)
    expect(normalizeFirstDayOfWeek(undefined)).toBe(1)
  })

  it('intlLocaleFor: ru→ru-RU, en→en-US', () => {
    expect(intlLocaleFor('ru')).toBe('ru-RU')
    expect(intlLocaleFor('en')).toBe('en-US')
  })
})

describe('useLocale — reactive source', () => {
  beforeEach(() => {
    setLocalePrefs({ language: 'ru', firstDayOfWeek: 1 })
  })

  it('дефолт: ru-RU, понедельник (1), date-fns ru', () => {
    expect(intlLocale.value).toBe('ru-RU')
    expect(weekStartsOn.value).toBe(1)
    expect(dateFnsLocale.value).toBe(ru)
  })

  it('setLocalePrefs(en, 0): en-US, воскресенье (0), date-fns enUS', () => {
    setLocalePrefs({ language: 'en', firstDayOfWeek: 0 })
    expect(intlLocale.value).toBe('en-US')
    expect(weekStartsOn.value).toBe(0)
    expect(dateFnsLocale.value).toBe(enUS)
  })

  it('частичное обновление сохраняет другое поле', () => {
    setLocalePrefs({ language: 'en' })
    expect(intlLocale.value).toBe('en-US')
    expect(weekStartsOn.value).toBe(1)
  })

  it('невалидные значения нормализуются (язык→ru, день→1)', () => {
    setLocalePrefs({ language: 'zz', firstDayOfWeek: 99 })
    expect(intlLocale.value).toBe('ru-RU')
    expect(weekStartsOn.value).toBe(1)
  })

  it('useLocale() возвращает те же реактивные значения', () => {
    setLocalePrefs({ language: 'en', firstDayOfWeek: 6 })
    const l = useLocale()
    expect(l.intlLocale.value).toBe('en-US')
    expect(l.weekStartsOn.value).toBe(6)
    expect(l.dateFnsLocale.value).toBe(enUS)
    expect(l.language.value).toBe('en')
    expect(l.firstDayOfWeek.value).toBe(6)
  })
})
