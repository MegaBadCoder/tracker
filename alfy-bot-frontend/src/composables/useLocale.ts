import { ref, computed } from 'vue'
import { ru, enUS } from 'date-fns/locale'
import type { Locale } from 'date-fns'

export type AppLanguage = 'ru' | 'en'
export type FirstDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

// ── Pure resolvers (unit-tested) ──

export function normalizeLanguage(lang?: string): AppLanguage {
  return lang === 'en' ? 'en' : 'ru'
}

export function normalizeFirstDayOfWeek(day?: number): FirstDayOfWeek {
  return typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 6
    ? (day as FirstDayOfWeek)
    : 1
}

export function intlLocaleFor(lang: AppLanguage): string {
  return lang === 'en' ? 'en-US' : 'ru-RU'
}

// ── Single reactive source of truth ──
// Module-level refs. Consumers (reka-ui calendars, formatters.ts, week.ts) read
// the computeds below; reading `.value` during a component render registers a
// dependency, so changing the user's setting re-renders without a reload.
// The user-store is the persistence layer and pushes changes here via setLocalePrefs.

const language = ref<AppLanguage>('ru')
const firstDayOfWeek = ref<FirstDayOfWeek>(1)

export function setLocalePrefs(prefs: { language?: string; firstDayOfWeek?: number }): void {
  // undefined = "don't change" — lets a minimal profile (e.g. Telegram authorize
  // with only first/last name) pass through without clobbering prefs already
  // restored from localStorage. Only explicit values update the source.
  if (prefs.language !== undefined) language.value = normalizeLanguage(prefs.language)
  if (prefs.firstDayOfWeek !== undefined) firstDayOfWeek.value = normalizeFirstDayOfWeek(prefs.firstDayOfWeek)
}

export const intlLocale = computed(() => intlLocaleFor(language.value))
export const weekStartsOn = computed<FirstDayOfWeek>(() => firstDayOfWeek.value)
export const dateFnsLocale = computed<Locale>(() => (language.value === 'en' ? enUS : ru))

export function useLocale() {
  return { language, firstDayOfWeek, intlLocale, weekStartsOn, dateFnsLocale }
}
