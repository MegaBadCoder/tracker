import { RecurrenceRule } from '../../../shared/types/recurrence.types';
import { Task } from '../../../shared/entities';
import {
  computeNextDueDate,
  buildNextInstance,
  isSeriesEnded,
  findNextOccurrenceOnOrAfter,
} from './recurrence.utils';

function d(iso: string): Date {
  return new Date(iso);
}

function makeRule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return { frequency: 'daily', interval: 1, ...overrides };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  const task = new Task();
  Object.assign(task, {
    id: 'task-1',
    userId: 1,
    title: 'Test task',
    description: 'desc',
    completed: true,
    priority: 'high',
    dueDate: d('2026-04-05T10:00:00.000Z'),
    deadline: null,
    location: 'Office',
    tags: ['work', 'dev'],
    recurrence: makeRule(),
    recurringParentId: null,
    recurringCompletedCount: 0,
    isAutoCreated: false,
    checklist: null,
    pomodoroConfig: null,
    createdAt: d('2026-04-01T00:00:00.000Z'),
    updatedAt: d('2026-04-05T00:00:00.000Z'),
    ...overrides,
  });
  return task;
}

// ── computeNextDueDate ──────────────────────────────────────────────

describe('computeNextDueDate', () => {
  it('daily interval=1 -> +1 day', () => {
    const result = computeNextDueDate(
      d('2026-04-05T10:00:00.000Z'),
      makeRule(),
    );
    expect(result).toEqual(d('2026-04-06T10:00:00.000Z'));
  });

  it('daily interval=3 -> +3 days', () => {
    const result = computeNextDueDate(
      d('2026-04-05T10:00:00.000Z'),
      makeRule({ interval: 3 }),
    );
    expect(result).toEqual(d('2026-04-08T10:00:00.000Z'));
  });

  it('weekly interval=1 without daysOfWeek -> +7 days', () => {
    const result = computeNextDueDate(
      d('2026-04-05T10:00:00.000Z'),
      makeRule({ frequency: 'weekly' }),
    );
    expect(result).toEqual(d('2026-04-12T10:00:00.000Z'));
  });

  it('weekly interval=2 -> +14 days', () => {
    const result = computeNextDueDate(
      d('2026-04-05T10:00:00.000Z'),
      makeRule({ frequency: 'weekly', interval: 2 }),
    );
    expect(result).toEqual(d('2026-04-19T10:00:00.000Z'));
  });

  it('weekly daysOfWeek=[1,3] (Mon,Wed), current Mon -> next Wed same week', () => {
    // 2026-04-06 is Monday
    const result = computeNextDueDate(
      d('2026-04-06T10:00:00.000Z'),
      makeRule({ frequency: 'weekly', interval: 1, daysOfWeek: [1, 3] }),
    );
    // next matching day is Wednesday 2026-04-08
    expect(result).toEqual(d('2026-04-08T10:00:00.000Z'));
  });

  it('weekly daysOfWeek=[1,3], current Wed -> next Mon (+interval weeks)', () => {
    // 2026-04-08 is Wednesday
    const result = computeNextDueDate(
      d('2026-04-08T10:00:00.000Z'),
      makeRule({ frequency: 'weekly', interval: 1, daysOfWeek: [1, 3] }),
    );
    // next matching day: Monday 2026-04-13
    expect(result).toEqual(d('2026-04-13T10:00:00.000Z'));
  });

  it('monthly interval=1 -> +1 month, same day', () => {
    const result = computeNextDueDate(
      d('2026-04-05T10:00:00.000Z'),
      makeRule({ frequency: 'monthly' }),
    );
    expect(result).toEqual(d('2026-05-05T10:00:00.000Z'));
  });

  it('monthly dayOfMonth=31, January -> clamps to Feb 28', () => {
    const result = computeNextDueDate(
      d('2026-01-31T10:00:00.000Z'),
      makeRule({ frequency: 'monthly', dayOfMonth: 31 }),
    );
    expect(result).toEqual(d('2026-02-28T10:00:00.000Z'));
  });

  it('monthly interval=2 -> +2 months', () => {
    const result = computeNextDueDate(
      d('2026-04-05T10:00:00.000Z'),
      makeRule({ frequency: 'monthly', interval: 2 }),
    );
    expect(result).toEqual(d('2026-06-05T10:00:00.000Z'));
  });

  it('yearly interval=1 -> +1 year', () => {
    const result = computeNextDueDate(
      d('2026-04-05T10:00:00.000Z'),
      makeRule({ frequency: 'yearly' }),
    );
    expect(result).toEqual(d('2027-04-05T10:00:00.000Z'));
  });

  it('yearly Feb 29 -> Feb 28 in non-leap year', () => {
    // 2028 is leap year, 2029 is not
    const result = computeNextDueDate(
      d('2028-02-29T10:00:00.000Z'),
      makeRule({ frequency: 'yearly' }),
    );
    expect(result).toEqual(d('2029-02-28T10:00:00.000Z'));
  });

  it('preserves time (hours, minutes) when shifting date', () => {
    const result = computeNextDueDate(
      d('2026-04-05T14:30:00.000Z'),
      makeRule(),
    );
    expect(result!.getUTCHours()).toBe(14);
    expect(result!.getUTCMinutes()).toBe(30);
  });
});

// ── computeNextDueDate — series ending ──────────────────────────────

describe('computeNextDueDate — series ending', () => {
  it('endDate in the past -> null', () => {
    const result = computeNextDueDate(
      d('2026-04-05T10:00:00.000Z'),
      makeRule({ endDate: '2026-04-01T00:00:00.000Z' }),
    );
    expect(result).toBeNull();
  });

  it('endDate = nextDate -> returns nextDate (boundary)', () => {
    const result = computeNextDueDate(
      d('2026-04-05T10:00:00.000Z'),
      makeRule({ endDate: '2026-04-06T10:00:00.000Z' }),
    );
    expect(result).toEqual(d('2026-04-06T10:00:00.000Z'));
  });

  it('endDate < nextDate -> null', () => {
    const result = computeNextDueDate(
      d('2026-04-05T10:00:00.000Z'),
      makeRule({ endDate: '2026-04-06T00:00:00.000Z' }),
    );
    expect(result).toBeNull();
  });

  it('endCount=3, completedCount=3 -> null', () => {
    const result = computeNextDueDate(
      d('2026-04-05T10:00:00.000Z'),
      makeRule({ endCount: 3 }),
      3,
    );
    expect(result).toBeNull();
  });

  it('endCount=3, completedCount=2 -> returns date', () => {
    const result = computeNextDueDate(
      d('2026-04-05T10:00:00.000Z'),
      makeRule({ endCount: 3 }),
      2,
    );
    expect(result).toEqual(d('2026-04-06T10:00:00.000Z'));
  });

  it('no endDate and no endCount -> always returns date', () => {
    const result = computeNextDueDate(
      d('2026-04-05T10:00:00.000Z'),
      makeRule(),
    );
    expect(result).not.toBeNull();
  });
});

// ── computeNextDueDate — edge cases ────────────────────────────────

describe('computeNextDueDate — edge cases', () => {
  it('daysOfWeek empty array for weekly -> fallback to +interval weeks', () => {
    const result = computeNextDueDate(
      d('2026-04-05T10:00:00.000Z'),
      makeRule({ frequency: 'weekly', daysOfWeek: [] }),
    );
    expect(result).toEqual(d('2026-04-12T10:00:00.000Z'));
  });

  it('dayOfMonth=29 + monthly + February non-leap -> clamp to 28', () => {
    // 2026-01-29 + monthly with dayOfMonth=29
    const result = computeNextDueDate(
      d('2026-01-29T10:00:00.000Z'),
      makeRule({ frequency: 'monthly', dayOfMonth: 29 }),
    );
    expect(result).toEqual(d('2026-02-28T10:00:00.000Z'));
  });
});

// ── isSeriesEnded ───────────────────────────────────────────────────

describe('isSeriesEnded', () => {
  it('returns false when no end conditions', () => {
    expect(isSeriesEnded(makeRule(), 0)).toBe(false);
  });

  it('returns true when completedCount >= endCount', () => {
    expect(isSeriesEnded(makeRule({ endCount: 3 }), 3)).toBe(true);
  });

  it('returns false when completedCount < endCount', () => {
    expect(isSeriesEnded(makeRule({ endCount: 3 }), 2)).toBe(false);
  });
});

// ── buildNextInstance ───────────────────────────────────────────────

describe('buildNextInstance', () => {
  const nextDueDate = d('2026-04-06T10:00:00.000Z');
  const parentId = 'root-task-id';

  it('copies title, description, priority, location, tags, recurrence, userId', () => {
    const task = makeTask();
    const instance = buildNextInstance(task, nextDueDate, parentId);

    expect(instance.title).toBe('Test task');
    expect(instance.description).toBe('desc');
    expect(instance.priority).toBe('high');
    expect(instance.location).toBe('Office');
    expect(instance.tags).toEqual(['work', 'dev']);
    expect(instance.recurrence).toEqual(task.recurrence);
    expect(instance.userId).toBe(1);
  });

  it('sets dueDate = nextDueDate', () => {
    const instance = buildNextInstance(makeTask(), nextDueDate, parentId);
    expect(instance.dueDate).toEqual(nextDueDate);
  });

  it('sets recurringParentId = parentId', () => {
    const instance = buildNextInstance(makeTask(), nextDueDate, parentId);
    expect(instance.recurringParentId).toBe(parentId);
  });

  it('sets completed=false, isAutoCreated=true', () => {
    const instance = buildNextInstance(makeTask(), nextDueDate, parentId);
    expect(instance.completed).toBe(false);
    expect(instance.isAutoCreated).toBe(true);
  });

  it('resets checklist items completed=false (preserving text and order)', () => {
    const task = makeTask({
      checklist: {
        items: [
          { id: '1', text: 'Step 1', completed: true, order: 0 },
          { id: '2', text: 'Step 2', completed: true, order: 1 },
        ],
      },
    });
    const instance = buildNextInstance(task, nextDueDate, parentId);
    expect(instance.checklist).not.toBeNull();
    expect(instance.checklist!.items).toHaveLength(2);
    expect(instance.checklist!.items[0].text).toBe('Step 1');
    expect(instance.checklist!.items[0].completed).toBe(false);
    expect(instance.checklist!.items[1].text).toBe('Step 2');
    expect(instance.checklist!.items[1].completed).toBe(false);
  });

  it('does NOT copy id, createdAt, updatedAt', () => {
    const instance = buildNextInstance(makeTask(), nextDueDate, parentId);
    expect(instance).not.toHaveProperty('id');
    expect(instance).not.toHaveProperty('createdAt');
    expect(instance).not.toHaveProperty('updatedAt');
  });

  it('null checklist -> checklist=null', () => {
    const instance = buildNextInstance(
      makeTask({ checklist: null }),
      nextDueDate,
      parentId,
    );
    expect(instance.checklist).toBeNull();
  });

  it('null recurrence on task -> recurrence=null on instance', () => {
    const instance = buildNextInstance(
      makeTask({ recurrence: null }),
      nextDueDate,
      parentId,
    );
    expect(instance.recurrence).toBeNull();
  });
});

// ── findNextOccurrenceOnOrAfter ─────────────────────────────────────

describe('findNextOccurrenceOnOrAfter', () => {
  it('daily interval=1, currentDue=yesterday, ref=today -> today', () => {
    // currentDue yesterday + 1 day = today (>= ref) -> today
    const result = findNextOccurrenceOnOrAfter(
      d('2026-04-28T10:00:00.000Z'),
      makeRule(),
      d('2026-04-29T10:00:00.000Z'),
    );
    expect(result).toEqual(d('2026-04-29T10:00:00.000Z'));
  });

  it('weekly Mon/Wed/Fri, currentDue=last Wed, ref=Thursday -> next Friday', () => {
    // 2026-04-22 is Wednesday, ref 2026-04-23 is Thursday.
    // Next occurrence in [Mon=1, Wed=3, Fri=5] >= Thursday is Friday 2026-04-24.
    const result = findNextOccurrenceOnOrAfter(
      d('2026-04-22T10:00:00.000Z'),
      makeRule({ frequency: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] }),
      d('2026-04-23T10:00:00.000Z'),
    );
    expect(result).toEqual(d('2026-04-24T10:00:00.000Z'));
  });

  it('weekly Mon/Wed/Fri, currentDue=last Friday, ref=Saturday -> next Monday', () => {
    // 2026-04-24 is Friday, ref 2026-04-25 is Saturday.
    // Next matching day >= Saturday is Monday 2026-04-27.
    const result = findNextOccurrenceOnOrAfter(
      d('2026-04-24T10:00:00.000Z'),
      makeRule({ frequency: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] }),
      d('2026-04-25T10:00:00.000Z'),
    );
    expect(result).toEqual(d('2026-04-27T10:00:00.000Z'));
  });

  it('monthly dayOfMonth=15, currentDue=last 15th, ref=16th of that month -> 15th of next month', () => {
    const result = findNextOccurrenceOnOrAfter(
      d('2026-03-15T10:00:00.000Z'),
      makeRule({ frequency: 'monthly', interval: 1, dayOfMonth: 15 }),
      d('2026-03-16T10:00:00.000Z'),
    );
    expect(result).toEqual(d('2026-04-15T10:00:00.000Z'));
  });

  it('yearly interval=1, currentDue=last year same date, ref=today -> next year same date', () => {
    const result = findNextOccurrenceOnOrAfter(
      d('2025-04-29T10:00:00.000Z'),
      makeRule({ frequency: 'yearly', interval: 1 }),
      d('2026-04-29T10:00:00.000Z'),
    );
    expect(result).toEqual(d('2026-04-29T10:00:00.000Z'));
  });

  it('endCount reached (completedCount >= endCount) -> null', () => {
    const result = findNextOccurrenceOnOrAfter(
      d('2026-04-05T10:00:00.000Z'),
      makeRule({ endCount: 3 }),
      d('2026-04-29T10:00:00.000Z'),
      3,
    );
    expect(result).toBeNull();
  });

  it('endDate in the past relative to expected next -> null', () => {
    // currentDue + 1 day = 2026-04-06, but endDate cuts series at 2026-04-05.
    const result = findNextOccurrenceOnOrAfter(
      d('2026-04-05T10:00:00.000Z'),
      makeRule({ endDate: '2026-04-05T00:00:00.000Z' }),
      d('2026-04-29T10:00:00.000Z'),
    );
    expect(result).toBeNull();
  });
});
