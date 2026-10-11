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

/** Compact "сколько осталось" for the sidebar: «45 мин», «3 ч 12 мин», «2 ч». */
export function formatRemaining(minutes: number): string {
  if (minutes < 1) return 'меньше минуты'

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (hours === 0) return `${rest} мин`
  if (rest === 0) return `${hours} ч`
  return `${hours} ч ${rest} мин`
}

export const formatPomodoro = (value: number): string => {
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** «1 задача», «2 задачи», «5 задач» — склонение по русским правилам. */
export function formatTaskCount(count: number): string {
  const abs = Math.abs(count)
  const mod10 = abs % 10
  const mod100 = abs % 100

  if (mod10 === 1 && mod100 !== 11)
    return `${count} задача`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return `${count} задачи`
  return `${count} задач`
}
