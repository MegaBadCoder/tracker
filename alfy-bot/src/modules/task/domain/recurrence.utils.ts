import type { RecurrenceRule } from '../../../shared/types/recurrence.types';
import type { ChecklistData } from '../../../shared/types/checklist.types';

export type RescheduleScope = 'this' | 'subsequent';

/** Plain snapshot of task fields needed by domain logic — no ORM dependency. */
export interface RecurringTaskSnapshot {
  title: string;
  description: string | null;
  priority: string | null;
  dueDate: Date | null;
  recurrenceAnchorDate?: Date | null;
  deadline: Date | null;
  location: string | null;
  tags: string[] | null;
  recurrence: RecurrenceRule | null;
  userId: number;
  projectId: string | null;
  columnId: string | null;
  order: number;
  checklist: ChecklistData | null;
  onMissed: 'shift' | 'freeze';
}

export interface SeriesDueFields {
  dueDate: Date | null;
  recurrenceAnchorDate: Date | null;
}

export interface Rescheduleable extends SeriesDueFields {
  recurrence: RecurrenceRule | null;
}

/** Series slot used to project ghosts and spawn the next instance. */
export function seriesDueDate(task: SeriesDueFields): Date | null {
  return task.recurrenceAnchorDate ?? task.dueDate;
}

/**
 * Move this instance and/or the series anchor.
 * `this` keeps the original schedule; `subsequent` makes the new dueDate the series slot.
 */
export function applyDueDateReschedule(
  task: Rescheduleable,
  newDueDate: Date | null,
  scope: RescheduleScope,
): SeriesDueFields {
  if (newDueDate === null) {
    return { dueDate: null, recurrenceAnchorDate: null };
  }

  if (!task.recurrence) {
    return { dueDate: newDueDate, recurrenceAnchorDate: null };
  }

  if (scope === 'subsequent') {
    return { dueDate: newDueDate, recurrenceAnchorDate: null };
  }

  const anchor = task.recurrenceAnchorDate ?? task.dueDate;
  if (anchor && anchor.getTime() === newDueDate.getTime()) {
    return { dueDate: newDueDate, recurrenceAnchorDate: null };
  }

  return { dueDate: newDueDate, recurrenceAnchorDate: anchor };
}

/**
 * Shift the rule so remaining occurrences follow `toDate`'s wall-clock
 * weekday / day-of-month. Dates must already be in user wall-clock UTC fields.
 */
export function retargetRecurrenceToDate(
  rule: RecurrenceRule,
  fromSlot: Date,
  toDate: Date,
): RecurrenceRule {
  if (rule.frequency === 'weekly' && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
    const delta = (toDate.getUTCDay() - fromSlot.getUTCDay() + 7) % 7;
    if (delta === 0) return rule;
    const daysOfWeek = [
      ...new Set(rule.daysOfWeek.map((day) => (day + delta) % 7)),
    ].sort((a, b) => a - b);
    return { ...rule, daysOfWeek };
  }

  if (rule.frequency === 'monthly') {
    const dayOfMonth = toDate.getUTCDate();
    if (rule.dayOfMonth === dayOfMonth) return rule;
    return { ...rule, dayOfMonth };
  }

  return rule;
}

export function isSeriesEnded(
  rule: RecurrenceRule,
  completedCount: number,
): boolean {
  if (rule.endCount !== undefined && completedCount >= rule.endCount) {
    return true;
  }
  return false;
}

/**
 * Compute the next due date based on the current date and recurrence rule.
 * Returns null if the series has ended (endDate/endCount reached).
 *
 * @param completedCount — pass root task's recurringCompletedCount for endCount check
 */
export function computeNextDueDate(
  currentDue: Date,
  rule: RecurrenceRule,
  completedCount = 0,
): Date | null {
  if (isSeriesEnded(rule, completedCount)) return null;

  const next = computeRawNext(currentDue, rule);

  if (rule.endDate) {
    const end = new Date(rule.endDate);
    if (next.getTime() > end.getTime()) return null;
  }

  return next;
}

function computeRawNext(currentDue: Date, rule: RecurrenceRule): Date {
  const { frequency, interval } = rule;

  switch (frequency) {
    case 'daily':
      return addDays(currentDue, interval);

    case 'weekly':
      return computeWeeklyNext(currentDue, rule);

    case 'monthly':
      return computeMonthlyNext(currentDue, rule);

    case 'yearly':
      return addYears(currentDue, interval);
  }
}

function computeWeeklyNext(currentDue: Date, rule: RecurrenceRule): Date {
  const { interval, daysOfWeek } = rule;

  if (!daysOfWeek || daysOfWeek.length === 0) {
    return addDays(currentDue, 7 * interval);
  }

  const sorted = [...daysOfWeek].sort((a, b) => a - b);
  const currentDay = currentDue.getUTCDay();

  // Find the next day in the same cycle (same week or interval-weeks ahead)
  const nextInCycle = sorted.find((day) => day > currentDay);

  if (nextInCycle !== undefined) {
    // There's a later day this week
    const diff = nextInCycle - currentDay;
    return addDays(currentDue, diff);
  }

  // Wrap to first day of next interval-cycle
  const daysUntilEndOfWeek = 7 - currentDay;
  const daysToSkip = (interval - 1) * 7;
  const daysToFirstDay = sorted[0];
  return addDays(currentDue, daysUntilEndOfWeek + daysToSkip + daysToFirstDay);
}

function computeMonthlyNext(currentDue: Date, rule: RecurrenceRule): Date {
  const { interval, dayOfMonth } = rule;

  const targetDay = dayOfMonth ?? currentDue.getUTCDate();
  const targetMonth = currentDue.getUTCMonth() + interval;

  // Build date at day=1 to avoid overflow, then clamp
  const next = new Date(currentDue);
  next.setUTCDate(1);
  next.setUTCMonth(targetMonth);

  const year = next.getUTCFullYear();
  const month = next.getUTCMonth();
  const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(targetDay, maxDay));

  return next;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  const targetYear = result.getUTCFullYear() + years;
  result.setUTCFullYear(targetYear);

  // Handle Feb 29 -> Feb 28 in non-leap year
  if (
    date.getUTCMonth() === 1 &&
    date.getUTCDate() === 29 &&
    result.getUTCDate() !== 29
  ) {
    result.setUTCMonth(1, 28);
  }

  return result;
}

/** Result of building the next instance — plain data, no entity class. */
export interface NextInstanceData {
  title: string;
  description: string | null;
  priority: string | null;
  dueDate: Date;
  recurrenceAnchorDate: null;
  deadline: Date | null;
  location: string | null;
  tags: string[] | null;
  recurrence: RecurrenceRule | null;
  recurringParentId: string;
  recurringCompletedCount: 0;
  isAutoCreated: boolean;
  completed: false;
  userId: number;
  projectId: string | null;
  columnId: string | null;
  order: number;
  checklist: ChecklistData | null;
  onMissed: 'shift' | 'freeze';
}

/**
 * Domain factory: builds the next recurring task instance from a completed task.
 * Pure function — no side effects, no repository calls.
 */
export function buildNextInstance(
  completedTask: RecurringTaskSnapshot,
  nextDueDate: Date,
  parentId: string,
): NextInstanceData {
  return {
    title: completedTask.title,
    description: completedTask.description,
    priority: completedTask.priority,
    dueDate: nextDueDate,
    recurrenceAnchorDate: null,
    deadline: completedTask.deadline,
    location: completedTask.location,
    tags: completedTask.tags ? [...completedTask.tags] : null,
    recurrence: completedTask.recurrence,
    recurringParentId: parentId,
    recurringCompletedCount: 0,
    isAutoCreated: true,
    completed: false,
    userId: completedTask.userId,
    projectId: completedTask.projectId ?? null,
    columnId: completedTask.columnId ?? null,
    order: completedTask.order ?? 0,
    checklist: resetChecklist(completedTask.checklist),
    onMissed: completedTask.onMissed,
  };
}

/**
 * Find the first occurrence on or after `refDateUtc` by iteratively advancing
 * `currentDue` via `computeNextDueDate`. Returns null if the series ends before
 * reaching `refDateUtc`. Bounded at 500 iterations to avoid runaway loops.
 *
 * @param completedCount — passed through to `computeNextDueDate` for endCount checks.
 */
export function findNextOccurrenceOnOrAfter(
  currentDue: Date,
  rule: RecurrenceRule,
  refDateUtc: Date,
  completedCount = 0,
): Date | null {
  const MAX_ITERATIONS = 500;
  let cursor = currentDue;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const next = computeNextDueDate(cursor, rule, completedCount);
    if (next === null) return null;

    if (next.getTime() >= refDateUtc.getTime()) {
      return next;
    }

    cursor = next;
  }

  throw new Error(
    `findNextOccurrenceOnOrAfter exceeded ${MAX_ITERATIONS} iterations for frequency=${rule.frequency}`,
  );
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** True if `occurrenceDate` is a future step of the series starting at `originDue`. */
export function isOccurrenceOnSeries(
  originDue: Date,
  rule: RecurrenceRule,
  occurrenceDate: Date,
  completedCount = 0,
): boolean {
  const startOfOccurrenceDay = new Date(occurrenceDate);
  startOfOccurrenceDay.setUTCHours(0, 0, 0, 0);

  let landed: Date | null;
  try {
    landed = findNextOccurrenceOnOrAfter(
      originDue,
      rule,
      startOfOccurrenceDay,
      completedCount,
    );
  } catch {
    return false;
  }

  return landed !== null && isSameUtcDay(landed, occurrenceDate);
}

export function findOccupyingInstance<T extends SeriesDueFields>(
  members: T[],
  slotDate: Date,
): T | undefined {
  return members.find((member) => {
    const slot = seriesDueDate(member);
    return slot !== null && isSameUtcDay(slot, slotDate);
  });
}

function resetChecklist(checklist: ChecklistData | null): ChecklistData | null {
  if (!checklist || !checklist.items || checklist.items.length === 0) {
    return null;
  }
  return {
    items: checklist.items.map((item) => ({
      ...item,
      completed: false,
    })),
  };
}
