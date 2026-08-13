export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  interval: number
  daysOfWeek?: number[]
  dayOfMonth?: number
  endDate?: string
  endCount?: number
}

const DAY_NAMES_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

export function formatRecurrence(rule: RecurrenceRule | null | undefined): string {
  if (!rule) return 'Нет'

  const { frequency, interval, daysOfWeek, dayOfMonth } = rule

  switch (frequency) {
    case 'daily':
      return interval === 1 ? 'Каждый день' : `Каждые ${interval} дня`

    case 'weekly':
      if (daysOfWeek && daysOfWeek.length > 0) {
        // Sort Mon-first: 1,2,3,4,5,6,0
        const monFirst = (d: number) => (d === 0 ? 7 : d)
        const days = daysOfWeek
          .slice()
          .sort((a, b) => monFirst(a) - monFirst(b))
          .map((d) => DAY_NAMES_SHORT[d])
          .join(', ')
        return `Каждый ${days}`
      }
      return interval === 1 ? 'Каждую неделю' : `Каждые ${interval} недели`

    case 'monthly':
      if (dayOfMonth) {
        return interval === 1
          ? `Каждый месяц ${dayOfMonth}-го`
          : `Каждые ${interval} месяца ${dayOfMonth}-го`
      }
      return interval === 1 ? 'Каждый месяц' : `Каждые ${interval} месяца`

    case 'yearly':
      return interval === 1 ? 'Каждый год' : `Каждые ${interval} года`

    default:
      return 'Повторение'
  }
}

export function computeNextDueDate(
  currentDue: Date,
  rule: RecurrenceRule,
  completedCount = 0,
): Date | null {
  if (rule.endCount !== undefined && completedCount >= rule.endCount) {
    return null
  }

  const next = computeRawNext(currentDue, rule)

  if (rule.endDate) {
    const end = new Date(rule.endDate)
    if (next.getTime() > end.getTime()) return null
  }

  return next
}

/**
 * Find the first occurrence on or after `refDate` by iteratively advancing
 * `currentDue` via `computeNextDueDate`. Returns null if the series ends before
 * reaching `refDate`. Bounded at 500 iterations to avoid runaway loops.
 *
 * Mirror of the backend `findNextOccurrenceOnOrAfter` in
 * `alfy-bot/src/modules/task/domain/recurrence.utils.ts` — keeps ghost
 * projection symmetric with backend completion logic.
 *
 * @param completedCount — passed through to `computeNextDueDate` for endCount checks.
 */
export function findNextOccurrenceOnOrAfter(
  currentDue: Date,
  rule: RecurrenceRule,
  refDate: Date,
  completedCount = 0,
): Date | null {
  const MAX_ITERATIONS = 500
  let cursor = currentDue

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const next = computeNextDueDate(cursor, rule, completedCount)
    if (next === null) return null

    if (next.getTime() >= refDate.getTime()) {
      return next
    }

    cursor = next
  }

  throw new Error(
    `findNextOccurrenceOnOrAfter exceeded ${MAX_ITERATIONS} iterations for frequency=${rule.frequency}`,
  )
}

export function seriesDueDate(task: {
  dueDate?: Date | null
  recurrenceAnchorDate?: Date | null
}): Date | null {
  return task.recurrenceAnchorDate ?? task.dueDate ?? null
}

function computeRawNext(currentDue: Date, rule: RecurrenceRule): Date {
  const { frequency, interval } = rule

  switch (frequency) {
    case 'daily':
      return addDays(currentDue, interval)
    case 'weekly':
      return computeWeeklyNext(currentDue, rule)
    case 'monthly':
      return computeMonthlyNext(currentDue, rule)
    case 'yearly':
      return addYears(currentDue, interval)
  }
}

function computeWeeklyNext(currentDue: Date, rule: RecurrenceRule): Date {
  const { interval, daysOfWeek } = rule

  if (!daysOfWeek || daysOfWeek.length === 0) {
    return addDays(currentDue, 7 * interval)
  }

  const sorted = [...daysOfWeek].sort((a, b) => a - b)
  const currentDay = currentDue.getDay()
  const nextInCycle = sorted.find((day) => day > currentDay)

  if (nextInCycle !== undefined) {
    return addDays(currentDue, nextInCycle - currentDay)
  }

  const daysUntilEndOfWeek = 7 - currentDay
  const daysToSkip = (interval - 1) * 7
  return addDays(currentDue, daysUntilEndOfWeek + daysToSkip + sorted[0]!)
}

function computeMonthlyNext(currentDue: Date, rule: RecurrenceRule): Date {
  const { interval, dayOfMonth } = rule
  const targetDay = dayOfMonth ?? currentDue.getDate()
  const targetMonth = currentDue.getMonth() + interval

  const next = new Date(currentDue)
  next.setDate(1)
  next.setMonth(targetMonth)

  const year = next.getFullYear()
  const month = next.getMonth()
  const maxDay = new Date(year, month + 1, 0).getDate()
  next.setDate(Math.min(targetDay, maxDay))

  return next
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date)
  result.setFullYear(result.getFullYear() + years)

  if (date.getMonth() === 1 && date.getDate() === 29 && result.getDate() !== 29) {
    result.setMonth(1, 28)
  }

  return result
}
