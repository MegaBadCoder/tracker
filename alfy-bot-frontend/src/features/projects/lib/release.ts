import type { BoardGroupNode, Release } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { pluralRu } from '@/lib/plural'
import { groupPath } from './group-tree'
import { parseLocalDate } from './sprint'

/**
 * Корзина задач релиза. `epic = null` — «Без эпика»; `story = null` при
 * заданном `epic` — задачи, лежащие прямо на эпике.
 */
export interface ReleaseTaskGroup {
  epic: BoardGroupNode | null
  story: BoardGroupNode | null
  tasks: Task[]
}

/** Задачи с данным `releaseId` в переданном списке. */
export function releaseTasks(tasks: Task[], releaseId: string): Task[] {
  return tasks.filter(t => t.releaseId === releaseId)
}

/** Прогресс релиза: число выполненных задач и общее число задач с данным `releaseId`. */
export function releaseProgress(tasks: Task[], releaseId: string): { done: number, total: number } {
  const inRelease = releaseTasks(tasks, releaseId)
  return { done: inRelease.filter(t => t.completed).length, total: inRelease.length }
}

/**
 * Просрочен ли релиз: запланирован, дата релиза (`YYYY-MM-DD`, локальный день)
 * задана и строго раньше локального дня `today`. Время внутри дня не учитывается;
 * выпущенный релиз и релиз без даты не бывают просроченными.
 */
export function isReleaseOverdue(release: Release, today: Date): boolean {
  if (release.status !== 'planned' || release.releaseDate === null)
    return false

  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return parseLocalDate(release.releaseDate).getTime() < start.getTime()
}

/**
 * Цель переноса незавершённых задач по умолчанию: id первого запланированного
 * релиза по `order`, кроме `currentId`, а если таких нет — `'none'`.
 */
export function defaultReleaseTarget(planned: Release[], currentId: string): 'none' | string {
  const first = [...planned].sort((a, b) => a.order - b.order).find(r => r.id !== currentId)
  return first ? first.id : 'none'
}

/**
 * Текст подтверждения удаления релиза. При `taskCount > 0` добавляет, что
 * задачи останутся без релиза; при 0 — только вопрос.
 */
export function releaseDeletionMessage(release: Release, taskCount: number): string {
  const question = `Удалить релиз „${release.name}“?`
  if (taskCount <= 0)
    return question

  const verb = pluralRu(taskCount, ['останется', 'останутся', 'останутся'])
  const word = pluralRu(taskCount, ['задача', 'задачи', 'задач'])
  return `${question} ${taskCount} ${word} ${verb} без релиза.`
}

/**
 * Текст для поля/чипа «Релиз»: «Без релиза» для `null`/`undefined`, имя релиза
 * для запланированного, «Имя (выпущен)» для выпущенного. `null`, если `releaseId`
 * указан, но не найден в переданном списке (релизы ещё грузятся).
 */
export function releaseLabel(releases: Release[], releaseId: string | null | undefined): string | null {
  if (releaseId == null)
    return 'Без релиза'

  const release = releases.find(r => r.id === releaseId)
  if (!release)
    return null

  return release.status === 'released' ? `${release.name} (выпущен)` : release.name
}

/**
 * Раскладывает задачи релиза по корзинам (эпик, история). Порядок: эпики по
 * `order`; внутри эпика сначала задачи прямо на эпике (`story = null`), затем
 * истории по `order`; корзина «Без эпика» (`epic = null`) последней. Пустые
 * корзины опускаются, кроме историй, чей собственный релиз равен releaseId.
 * При releaseId = null показываются только корзины задач. Задачи с неизвестным `groupId` попадают в «Без эпика»,
 * порядок задач внутри корзины сохраняется.
 */
export function groupReleaseTasks(tasks: Task[], groups: BoardGroupNode[], releaseId: string | null): ReleaseTaskGroup[] {
  const buckets = new Map<string, Task[]>()
  const withoutEpic: Task[] = []

  for (const task of tasks) {
    const path = task.groupId ? groupPath(groups, task.groupId) : null
    if (!path) {
      withoutEpic.push(task)
      continue
    }
    const key = path.story ? path.story.id : path.epic.id
    const bucket = buckets.get(key)
    if (bucket)
      bucket.push(task)
    else
      buckets.set(key, [task])
  }

  const byOrder = (a: BoardGroupNode, b: BoardGroupNode) => a.order - b.order
  const result: ReleaseTaskGroup[] = []

  for (const epic of [...groups].sort(byOrder)) {
    const own = buckets.get(epic.id)
    if (own)
      result.push({ epic, story: null, tasks: own })

    for (const story of [...epic.children].sort(byOrder)) {
      const storyTasks = buckets.get(story.id)
      if (storyTasks || (releaseId !== null && story.releaseId === releaseId))
        result.push({ epic, story, tasks: storyTasks ?? [] })
    }
  }

  if (withoutEpic.length > 0)
    result.push({ epic: null, story: null, tasks: withoutEpic })

  return result
}
