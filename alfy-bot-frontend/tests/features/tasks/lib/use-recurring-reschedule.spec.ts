import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  shouldPromptReschedule,
  useRecurringReschedule,
  highlightedTaskId,
} from '@/features/tasks/lib/use-recurring-reschedule'
import type { Task } from '@/features/tasks/model/types'

const monday = new Date(2026, 3, 6, 10, 0)
const wednesday = new Date(2026, 3, 8, 15, 0)

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'Зарядка',
  completed: false,
  dueDate: monday,
  recurrence: { frequency: 'weekly', interval: 1 },
  ...overrides,
})

describe('shouldPromptReschedule', () => {
  it('true for uncompleted recurring with a different dueDate', () => {
    expect(shouldPromptReschedule(makeTask(), wednesday)).toBe(true)
  })

  it('false when dueDate did not change', () => {
    expect(shouldPromptReschedule(makeTask(), new Date(monday.getTime()))).toBe(false)
  })

  it('false for non-recurring', () => {
    expect(shouldPromptReschedule(makeTask({ recurrence: null }), wednesday)).toBe(false)
  })

  it('false when completed', () => {
    expect(shouldPromptReschedule(makeTask({ completed: true }), wednesday)).toBe(false)
  })

  it('false when overdue', () => {
    expect(shouldPromptReschedule(makeTask({ isOverdue: true }), wednesday)).toBe(false)
  })

  it('false when clearing dueDate', () => {
    expect(shouldPromptReschedule(makeTask(), null)).toBe(false)
  })

  it('false for materialized child — она не ведёт сетку', () => {
    expect(
      shouldPromptReschedule(
        makeTask({ recurringParentId: 'root-1', isAutoCreated: false }),
        wednesday,
      ),
    ).toBe(false)
  })

  it('true for auto-created cursor после complete', () => {
    expect(
      shouldPromptReschedule(
        makeTask({ recurringParentId: 'root-1', isAutoCreated: true }),
        wednesday,
      ),
    ).toBe(true)
  })
})

describe('useRecurringReschedule', () => {
  let updateTask: ReturnType<typeof vi.fn>
  let confirm: ReturnType<typeof vi.fn>

  beforeEach(() => {
    updateTask = vi.fn().mockResolvedValue(undefined)
    confirm = vi.fn().mockResolvedValue(false)
    highlightedTaskId.value = null
  })

  it('this-only: PATCH scope=this, then confirm cancel leaves series', async () => {
    confirm.mockImplementation(async () => {
      expect(highlightedTaskId.value).toBe('t1')
      return false
    })
    const { rescheduleDueDate } = useRecurringReschedule({ updateTask, confirm })
    await rescheduleDueDate(makeTask(), wednesday)

    expect(updateTask).toHaveBeenCalledTimes(1)
    expect(updateTask).toHaveBeenCalledWith(
      't1',
      { dueDate: wednesday, rescheduleScope: 'this' },
      false,
    )
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmText: 'Сместить все',
        cancelText: 'Оставить как есть',
      }),
    )
    expect(highlightedTaskId.value).toBeNull()
  })

  it('subsequent: second PATCH clears the series via scope=subsequent', async () => {
    confirm.mockResolvedValueOnce(true)
    const { rescheduleDueDate } = useRecurringReschedule({ updateTask, confirm })
    await rescheduleDueDate(makeTask(), wednesday)

    expect(updateTask).toHaveBeenCalledTimes(2)
    expect(updateTask.mock.calls[1]).toEqual([
      't1',
      { rescheduleScope: 'subsequent' },
      false,
    ])
  })

  it('non-recurring: single PATCH without scope or modal', async () => {
    const { rescheduleDueDate } = useRecurringReschedule({ updateTask, confirm })
    await rescheduleDueDate(makeTask({ recurrence: null }), wednesday)

    expect(confirm).not.toHaveBeenCalled()
    expect(updateTask).toHaveBeenCalledWith('t1', { dueDate: wednesday }, false)
  })

  it('materialized child: this-only без модалки', async () => {
    const { rescheduleDueDate } = useRecurringReschedule({ updateTask, confirm })
    await rescheduleDueDate(
      makeTask({ recurringParentId: 'root-1', isAutoCreated: false }),
      wednesday,
    )

    expect(confirm).not.toHaveBeenCalled()
    expect(updateTask).toHaveBeenCalledWith('t1', { dueDate: wednesday }, false)
  })

  it('auto-created cursor: модалка this/subsequent', async () => {
    const { rescheduleDueDate } = useRecurringReschedule({ updateTask, confirm })
    await rescheduleDueDate(
      makeTask({ recurringParentId: 'root-1', isAutoCreated: true }),
      wednesday,
    )

    expect(confirm).toHaveBeenCalled()
    expect(updateTask).toHaveBeenCalledWith(
      't1',
      { dueDate: wednesday, rescheduleScope: 'this' },
      false,
    )
  })

  it('второй сдвиг auto-created курсора снова показывает модалку', async () => {
    const friday = new Date(2026, 3, 10, 12, 0)
    const task = makeTask({ recurringParentId: 'root-1', isAutoCreated: true })
    const { rescheduleDueDate } = useRecurringReschedule({ updateTask, confirm })

    await rescheduleDueDate(task, wednesday)
    await rescheduleDueDate({ ...task, dueDate: wednesday }, friday)

    expect(confirm).toHaveBeenCalledTimes(2)
  })
})
