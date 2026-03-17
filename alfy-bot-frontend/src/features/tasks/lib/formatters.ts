import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export const formatDate = (date: Date | string, formatStr: string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, formatStr, { locale: ru })
}

export const formatPomodoro = (value: number): string => {
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
