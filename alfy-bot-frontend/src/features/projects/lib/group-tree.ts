import type { BoardGroupNode } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { pluralRu } from '@/lib/plural'

/** Ищет узел (эпик или историю) по id в дереве групп проекта. */
export function findGroup(tree: BoardGroupNode[], id: string): BoardGroupNode | undefined {
  for (const node of tree) {
    if (node.id === id)
      return node
    const found = findGroup(node.children, id)
    if (found)
      return found
  }
  return undefined
}

/**
 * Путь к группе: её родительский эпик (или сама группа, если это эпик) и
 * история, если `groupId` указывает на историю. `null`, если id не найден.
 */
export function groupPath(
  tree: BoardGroupNode[],
  groupId: string,
): { epic: BoardGroupNode, story: BoardGroupNode | null } | null {
  for (const epic of tree) {
    if (epic.id === groupId)
      return { epic, story: null }
    const story = epic.children.find(child => child.id === groupId)
    if (story)
      return { epic, story }
  }
  return null
}

/**
 * Id задач, принадлежащих группе: для эпика — id самого эпика и всех его
 * историй; для истории — только её собственный id.
 */
export function groupTaskIds(group: BoardGroupNode): string[] {
  return [group.id, ...group.children.map(child => child.id)]
}

/** Прогресс группы: сколько из её задач (см. {@link groupTaskIds}) завершено. */
export function groupProgress(group: BoardGroupNode, tasks: Task[]): { done: number, total: number } {
  const ids = new Set(groupTaskIds(group))
  const groupTasks = tasks.filter(task => task.groupId != null && ids.has(task.groupId))
  return {
    done: groupTasks.filter(task => task.completed).length,
    total: groupTasks.length,
  }
}

/**
 * Последствия удаления группы: число дочерних историй (0 для истории) и
 * число задач, которые останутся без группы (задачи самой группы и, для
 * эпика, задачи всех его историй).
 */
export function deletionImpact(group: BoardGroupNode, tasks: Task[]): { stories: number, tasks: number } {
  const ids = new Set(groupTaskIds(group))
  const affectedTasks = tasks.filter(task => task.groupId != null && ids.has(task.groupId))
  return {
    stories: group.children.length,
    tasks: affectedTasks.length,
  }
}

/**
 * Текст подтверждения удаления эпика/истории: называет последствия
 * ({@link deletionImpact}) до подтверждения. Один источник для доски и
 * карточки группы — тексты не должны расходиться.
 */
export function groupDeletionMessage(group: BoardGroupNode, impact: { stories: number, tasks: number }): string {
  const parts = [`Удалить ${group.type === 'epic' ? 'эпик' : 'историю'} „${group.title}“?`]

  if (group.type === 'epic' && impact.stories > 0) {
    const verb = pluralRu(impact.stories, ['удалится', 'удалятся', 'удалятся'])
    const word = pluralRu(impact.stories, ['история', 'истории', 'историй'])
    parts.push(`Вместе с ним ${verb} ${impact.stories} ${word}.`)
  }

  if (impact.tasks > 0) {
    const remainVerb = pluralRu(impact.tasks, ['останется', 'останутся', 'останутся'])
    const moveVerb = pluralRu(impact.tasks, ['переедет', 'переедут', 'переедут'])
    const word = pluralRu(impact.tasks, ['задача', 'задачи', 'задач'])
    parts.push(`${impact.tasks} ${word} ${remainVerb} и ${moveVerb} в „Без эпика“.`)
  }

  return parts.join(' ')
}
