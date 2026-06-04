import { format } from 'date-fns'
import { toDate } from './dateTime'
import { dateFnsLocale } from '@/composables/useLocale'

export const DATE_SHORT = 'd MMM'
export const DATE_WITH_TIME = 'd MMM, HH:mm'
export const DATE_FULL = 'd MMM yyyy'
export const DATE_FULL_TIME = 'd MMM yyyy, HH:mm'

export const formatDate = (date: Date | string, formatStr: string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, formatStr, { locale: dateFnsLocale.value })
}

export function formatDueDate(value: unknown, opts?: { includeYear?: boolean }): string {
  const date = toDate(value)
  if (!date) return ''
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
  if (opts?.includeYear) {
    return formatDate(date, hasTime ? DATE_FULL_TIME : DATE_FULL)
  }
  return formatDate(date, hasTime ? DATE_WITH_TIME : DATE_SHORT)
}

export const formatPomodoro = (value: number): string => {
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
