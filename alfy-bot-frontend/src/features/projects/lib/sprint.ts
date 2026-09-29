import type { Sprint } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { pluralRu } from '@/lib/plural'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Локальная полночь календарного дня `YYYY-MM-DD` (без сдвига по UTC). */
export function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year!, month! - 1, day!)
}

/**
 * Задачи спринта внутри проекта. `sprintId === null` — бэклог проекта:
 * задачи без спринта (`undefined` и `null` считаются одним и тем же).
 */
export function sprintTasks(tasks: Task[], sprintId: string | null, projectId: string): Task[] {
  return tasks.filter(t => t.projectId === projectId && (t.sprintId ?? null) === sprintId)
}

/** Прогресс спринта: число выполненных задач и общее число задач с данным `sprintId`. */
export function sprintProgress(tasks: Task[], sprintId: string): { done: number, total: number } {
  const inSprint = tasks.filter(t => t.sprintId === sprintId)
  return { done: inSprint.filter(t => t.completed).length, total: inSprint.length }
}

/**
 * Сколько календарных дней осталось до `endDate` (`YYYY-MM-DD`, локальная дата).
 * В последний день спринта — 0, после окончания — отрицательное число.
 * Время внутри дня `today` не учитывается.
 */
export function daysLeft(endDate: string, today: Date): number {
  const end = parseLocalDate(endDate)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY)
}

/**
 * Цель переноса незавершённых задач по умолчанию: id первого запланированного
 * спринта по `order`, а если таких нет — `'backlog'`.
 */
export function defaultCompleteTarget(planned: Sprint[]): 'backlog' | string {
  const first = [...planned].sort((a, b) => a.order - b.order)[0]
  return first ? first.id : 'backlog'
}

/**
 * Последний день спринта длительностью `weeks` недель, начатого `start`:
 * `start + weeks * 7 - 1` дней, то есть двухнедельный спринт с понедельника
 * 5 октября заканчивается в воскресенье 18 октября. Исходная дата не меняется.
 */
export function sprintEndFromDuration(start: Date, weeks: 1 | 2 | 3 | 4): Date {
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + weeks * 7 - 1)
}

/**
 * Текст подтверждения удаления спринта. При `taskCount > 0` добавляет, что
 * задачи вернутся в бэклог; при 0 — только вопрос.
 */
export function sprintDeletionMessage(sprint: Sprint, taskCount: number): string {
  const question = `Удалить „${sprint.name}“?`
  if (taskCount <= 0)
    return question

  const verb = pluralRu(taskCount, ['вернётся', 'вернутся', 'вернутся'])
  const word = pluralRu(taskCount, ['задача', 'задачи', 'задач'])
  return `${question} ${taskCount} ${word} ${verb} в бэклог.`
}
