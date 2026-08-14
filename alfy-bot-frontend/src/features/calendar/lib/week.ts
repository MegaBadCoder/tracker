import { addDays, addWeeks, eachDayOfInterval, format, isSameDay, startOfDay, startOfWeek } from 'date-fns'
import { dateFnsLocale, weekStartsOn } from '@/composables/useLocale'

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: weekStartsOn.value })
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
  const startMonth = format(weekStart, 'LLLL', { locale: dateFnsLocale.value })
  const endMonth = format(weekEnd, 'LLLL', { locale: dateFnsLocale.value })

  const startDay = format(weekStart, 'd')
  const endDay = format(weekEnd, 'd')
  const year = format(weekEnd, 'yyyy')

  if (startMonth === endMonth) {
    return `${startDay}\u2013${endDay} ${startMonth} ${year}`
  }
  return `${startDay} ${startMonth} \u2013 ${endDay} ${endMonth} ${year}`
}

export function formatDayHeader(date: Date): { dayName: string, dayNumber: string } {
  return {
    dayName: format(date, 'EEEEEE', { locale: dateFnsLocale.value }),
    dayNumber: format(date, 'd'),
  }
}

export function formatDayTitle(date: Date): string {
  return format(date, 'd MMMM yyyy', { locale: dateFnsLocale.value })
}

export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const t = startOfDay(date).getTime()
  return t >= startOfDay(start).getTime() && t <= startOfDay(end).getTime()
}

export function pickDayViewDate(
  range: { start: Date, end: Date },
  today: Date = new Date(),
): Date {
  const t = startOfDay(today)
  if (isDateInRange(t, range.start, range.end))
    return t
  return startOfDay(range.start)
}

export function formatDateRange(start: Date, end: Date): string {
  const startMonth = format(start, 'LLLL', { locale: dateFnsLocale.value })
  const endMonth = format(end, 'LLLL', { locale: dateFnsLocale.value })
  const year = format(end, 'yyyy')
  if (startMonth === endMonth) {
    return `${format(start, 'd')}–${format(end, 'd')} ${startMonth} ${year}`
  }
  return `${format(start, 'd')} ${startMonth} – ${format(end, 'd')} ${endMonth} ${year}`
}
