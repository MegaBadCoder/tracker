import { CalendarDate, type DateValue } from '@internationalized/date'

export function toDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'string') return new Date(value)
  if (typeof value === 'object' && value !== null && 'year' in value && 'month' in value && 'day' in value) {
    const v = value as { year: number; month: number; day: number; hour?: number; minute?: number }
    return new Date(v.year, v.month - 1, v.day, v.hour ?? 0, v.minute ?? 0)
  }
  return undefined
}

export function toCalendarDateValue(value: Date | undefined): DateValue | undefined {
  if (!value) return undefined
  return new CalendarDate(value.getFullYear(), value.getMonth() + 1, value.getDate())
}

export const getTimeString = (date: Date): string => {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export const updateDeadlineTime = (date: Date | undefined, timeString: string): Date | undefined => {
  if (!date || !timeString) return date

  const parts = timeString.split(':')
  const newDeadline = new Date(date)
  newDeadline.setHours(parseInt(parts[0] ?? '0'), parseInt(parts[1] ?? '0'))

  return newDeadline
}
