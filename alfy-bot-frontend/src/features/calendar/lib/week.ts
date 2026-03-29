import { startOfWeek, addWeeks, eachDayOfInterval, addDays, isSameDay, format } from 'date-fns'
import { ru } from 'date-fns/locale'

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function getWeekDays(weekStart: Date): Date[] {
  return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })
}

export function navigateWeek(weekStart: Date, direction: number): Date {
  return addWeeks(weekStart, direction)
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6)
  const startMonth = format(weekStart, 'LLLL', { locale: ru })
  const endMonth = format(weekEnd, 'LLLL', { locale: ru })

  const startDay = format(weekStart, 'd')
  const endDay = format(weekEnd, 'd')
  const year = format(weekEnd, 'yyyy')

  if (startMonth === endMonth) {
    return `${startDay}\u2013${endDay} ${startMonth} ${year}`
  }
  return `${startDay} ${startMonth} \u2013 ${endDay} ${endMonth} ${year}`
}

export function formatDayHeader(date: Date): { dayName: string; dayNumber: string } {
  return {
    dayName: format(date, 'EEEEEE', { locale: ru }),
    dayNumber: format(date, 'd'),
  }
}

export function formatDateRange(start: Date, end: Date): string {
  const startMonth = format(start, 'LLLL', { locale: ru })
  const endMonth = format(end, 'LLLL', { locale: ru })
  const year = format(end, 'yyyy')
  if (startMonth === endMonth) {
    return `${format(start, 'd')}–${format(end, 'd')} ${startMonth} ${year}`
  }
  return `${format(start, 'd')} ${startMonth} – ${format(end, 'd')} ${endMonth} ${year}`
}
