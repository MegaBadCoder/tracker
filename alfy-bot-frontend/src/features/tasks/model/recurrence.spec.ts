import { describe, it, expect } from 'vitest'
import {
  findNextOccurrenceOnOrAfter,
  type RecurrenceRule,
} from './recurrence'

// Local-time date constructor (year, monthIndex, day, hour, minute).
// Frontend recurrence helpers operate on local time per project TZ conventions,
// so all test inputs and assertions are constructed in local time to remain
// deterministic regardless of the runner's IANA timezone.
const local = (
  y: number,
  m: number,
  d: number,
  h = 0,
  min = 0,
) => new Date(y, m - 1, d, h, min, 0, 0)

const makeRule = (overrides: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  frequency: 'daily',
  interval: 1,
  ...overrides,
})

describe('findNextOccurrenceOnOrAfter', () => {
  it('daily, currentDue=last week, ref=today -> today same time', () => {
    // currentDue April 22 10:00 local. Daily steps land on April 29 10:00 local
    // which is >= ref April 29 00:00 local.
    const result = findNextOccurrenceOnOrAfter(
      local(2026, 4, 22, 10, 0),
      makeRule(),
      local(2026, 4, 29, 0, 0),
    )
    expect(result).toEqual(local(2026, 4, 29, 10, 0))
  })

  it('weekly Mon, currentDue=last Mon, ref=Wed (between Mons) -> next Mon', () => {
    // April 13 2026 is Monday. Stepping weekly Mon: April 20, April 27, May 4.
    // Ref April 29 (Wed) -> first Mon >= ref is May 4.
    const result = findNextOccurrenceOnOrAfter(
      local(2026, 4, 13, 10, 0),
      makeRule({ frequency: 'weekly', interval: 1, daysOfWeek: [1] }),
      local(2026, 4, 29, 0, 0),
    )
    expect(result).toEqual(local(2026, 5, 4, 10, 0))
  })

  it('currentDue in future, ref=today -> naturalNext (single step)', () => {
    // currentDue May 1 10:00 (already future relative to ref April 29 00:00).
    // First call yields May 2 10:00 which is >= ref -> returned.
    const result = findNextOccurrenceOnOrAfter(
      local(2026, 5, 1, 10, 0),
      makeRule(),
      local(2026, 4, 29, 0, 0),
    )
    expect(result).toEqual(local(2026, 5, 2, 10, 0))
  })

  it('endCount reached (completedCount >= endCount) -> null', () => {
    const result = findNextOccurrenceOnOrAfter(
      local(2026, 4, 5, 10, 0),
      makeRule({ endCount: 3 }),
      local(2026, 4, 29, 0, 0),
      3,
    )
    expect(result).toBeNull()
  })
})
