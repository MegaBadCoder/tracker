import type { Task } from '@/features/tasks/model/types'
import { describe, expect, it } from 'vitest'
import {
  countTodayTasks,
  shiftToSameTimeToday,
  splitTodayBuckets,
} from '@/features/tasks/lib/today'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Задача',
    completed: false,
    isOverdue: false,
    ...overrides,
  } as Task
}

/** Задача с датой; id выводится из даты, чтобы тесты порядка читались. */
function due(iso: string, overrides: Partial<Task> = {}): Task {
  return makeTask({ id: iso, dueDate: new Date(iso), ...overrides })
}

const at = (iso: string) => new Date(iso)

/** Вторник, середина дня — все тесты крутятся вокруг этого «сейчас». */
const NOW = at('2026-08-25T14:00:00')

describe('splitTodayBuckets', () => {
  it('вчерашняя живая задача попадает в overdue', () => {
    const task = due('2026-08-24T19:30:00')
    expect(splitTodayBuckets([task], NOW)).toEqual({ overdue: [task], today: [] })
  })

  it('сегодня 00:00 — сегодняшняя, не просроченная', () => {
    const task = due('2026-08-25T00:00:00')
    expect(splitTodayBuckets([task], NOW)).toEqual({ overdue: [], today: [task] })
  })

  it('сегодня 23:59 — всё ещё сегодняшняя', () => {
    const task = due('2026-08-25T23:59:00')
    expect(splitTodayBuckets([task], NOW)).toEqual({ overdue: [], today: [task] })
  })

  it('завтра 00:00 — ни в одну группу', () => {
    const task = due('2026-08-26T00:00:00')
    expect(splitTodayBuckets([task], NOW)).toEqual({ overdue: [], today: [] })
  })

  it('выполненная сегодняшняя задача не показывается', () => {
    const task = due('2026-08-25T10:00:00', { completed: true })
    expect(splitTodayBuckets([task], NOW)).toEqual({ overdue: [], today: [] })
  })

  it('замороженная (isOverdue) вчерашняя задача не показывается', () => {
    const task = due('2026-08-24T10:00:00', { isOverdue: true })
    expect(splitTodayBuckets([task], NOW)).toEqual({ overdue: [], today: [] })
  })

  it('задача без dueDate не показывается', () => {
    const task = makeTask()
    expect(splitTodayBuckets([task], NOW)).toEqual({ overdue: [], today: [] })
  })

  it('задачи из проекта участвуют наравне с задачами Входящих', () => {
    const inbox = due('2026-08-25T09:00:00')
    const inProject = due('2026-08-25T10:00:00', { projectId: 'proj-1' })
    expect(splitTodayBuckets([inbox, inProject], NOW).today).toEqual([inbox, inProject])
  })

  it('обе группы отсортированы по dueDate по возрастанию', () => {
    const oldest = due('2026-08-20T10:00:00')
    const newer = due('2026-08-24T10:00:00')
    const morning = due('2026-08-25T08:00:00')
    const evening = due('2026-08-25T20:00:00')

    const buckets = splitTodayBuckets([evening, newer, morning, oldest], NOW)

    expect(buckets.overdue).toEqual([oldest, newer])
    expect(buckets.today).toEqual([morning, evening])
  })

  it('не мутирует переданный массив', () => {
    const later = due('2026-08-25T20:00:00')
    const earlier = due('2026-08-25T08:00:00')
    const tasks = [later, earlier]

    splitTodayBuckets(tasks, NOW)

    expect(tasks).toEqual([later, earlier])
  })
})

describe('countTodayTasks', () => {
  it('считает сумму обеих групп на смешанном наборе', () => {
    const tasks = [
      due('2026-08-24T10:00:00'),
      due('2026-08-20T10:00:00'),
      due('2026-08-25T10:00:00'),
      due('2026-08-26T10:00:00'),
      due('2026-08-25T11:00:00', { completed: true }),
      due('2026-08-23T11:00:00', { isOverdue: true }),
      makeTask({ id: 'no-date' }),
    ]

    expect(countTodayTasks(tasks, NOW)).toBe(3)
  })

  it('пустой список даёт ноль', () => {
    expect(countTodayTasks([], NOW)).toBe(0)
  })
})

describe('shiftToSameTimeToday', () => {
  it('переносит на сегодня, сохраняя время суток', () => {
    expect(shiftToSameTimeToday(at('2026-08-24T19:30:00'), NOW)).toEqual(
      at('2026-08-25T19:30:00'),
    )
  })

  it('задача без времени остаётся без времени', () => {
    expect(shiftToSameTimeToday(at('2026-08-23T00:00:00'), NOW)).toEqual(
      at('2026-08-25T00:00:00'),
    )
  })

  it('не мутирует исходную дату', () => {
    const original = at('2026-08-24T19:30:00')
    shiftToSameTimeToday(original, NOW)
    expect(original).toEqual(at('2026-08-24T19:30:00'))
  })

  it('переносит через границу месяца, не съезжая по числу', () => {
    expect(shiftToSameTimeToday(at('2026-07-31T08:15:00'), at('2026-08-01T14:00:00'))).toEqual(
      at('2026-08-01T08:15:00'),
    )
  })
})
