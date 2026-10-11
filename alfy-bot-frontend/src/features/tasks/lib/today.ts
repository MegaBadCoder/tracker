import type { Task } from '../model/types'
import { endOfDay, startOfDay } from 'date-fns'

export interface TodayBuckets {
  /** Невыполненные задачи со сроком раньше сегодняшнего дня. */
  overdue: Task[]
  /** Невыполненные задачи со сроком внутри сегодняшних суток. */
  today: Task[]
}

/**
 * Задачи, требующие действия сегодня, разложенные на две группы.
 *
 * Единственное место, где живут предикаты групп: экран «Сегодня» и счётчик в
 * сайдбаре считают по нему же, поэтому разойтись не могут.
 *
 * `isOverdue` — это не «просрочена по дате», а флаг «заморожена» для
 * повторяющихся задач с `onMissed: 'freeze'`. Такие задачи иммутабельны на
 * бэкенде, действий с ними нет, и на этом экране им не место.
 *
 * `now` приходит аргументом, а не читается с часов, чтобы правило оставалось
 * чистым и тестировалось без подмены таймеров. Границы суток — локальные, по
 * timezone-конвенции фронта: локальное время браузера и есть время пользователя.
 */
export function splitTodayBuckets(tasks: Task[], now: Date): TodayBuckets {
  const dayStart = startOfDay(now).getTime()
  const dayEnd = endOfDay(now).getTime()

  const overdue: Task[] = []
  const today: Task[] = []

  for (const task of tasks) {
    if (task.completed || task.isOverdue || !task.dueDate)
      continue

    const due = new Date(task.dueDate).getTime()
    if (due < dayStart)
      overdue.push(task)
    else if (due <= dayEnd)
      today.push(task)
  }

  return { overdue: overdue.sort(byDueDate), today: today.sort(byDueDate) }
}

function byDueDate(a: Task, b: Task): number {
  return new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
}

/** Число для бейджа в сайдбаре — обе группы вместе. */
export function countTodayTasks(tasks: Task[], now: Date): number {
  const { overdue, today } = splitTodayBuckets(tasks, now)
  return overdue.length + today.length
}

/**
 * Та же задача, но сегодня: дата подменяется, время суток сохраняется.
 * «Вчера 19:30» становится «сегодня 19:30», а задача без времени (00:00)
 * остаётся без времени.
 */
export function shiftToSameTimeToday(dueDate: Date, now: Date): Date {
  const shifted = new Date(dueDate)
  // Все три компоненты за один вызов — иначе задача 31-го числа при переносе
  // в месяц покороче переползла бы на следующий месяц.
  shifted.setFullYear(now.getFullYear(), now.getMonth(), now.getDate())
  return shifted
}
