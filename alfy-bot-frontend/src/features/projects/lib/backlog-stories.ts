import type { BoardGroupNode } from '../model/types'
import type { Task } from '@/features/tasks/model/types'

/** Выбранный эпик; all показывает всё, none — задачи без эпика. */
export type EpicFilter = 'all' | 'none' | string

/** История с видимыми задачами и прогрессом всех её задач текущего блока. */
export interface BacklogStory {
  story: BoardGroupNode
  epic: BoardGroupNode
  tasks: Task[]
  done: number
  total: number
}

/** Проверяет принадлежность задачи выбранному эпику без изменения данных. */
export function matchesEpic(task: Task, tree: BoardGroupNode[], filter: EpicFilter): boolean {
  if (filter === 'all')
    return true
  const epic = tree.find(node => node.id === task.groupId || node.children.some(story => story.id === task.groupId))
  return filter === 'none' ? !epic : epic?.id === filter
}

/**
 * Группирует видимые задачи по историям. Истории без задач показываются
 * в назначенном спринте; скрытые задачи не делают историю пустой.
 * Прогресс считается по полному набору задач блока, независимо от фильтров.
 */
export function backlogStories(
  tree: BoardGroupNode[],
  visibleTasks: Task[],
  projectTasks: Task[],
  sprintId: string | null,
  filter: EpicFilter,
  showCompleted: boolean,
): BacklogStory[] {
  return tree.filter(epic => filter === 'all' || epic.id === filter).flatMap(epic =>
    epic.children.flatMap((story) => {
      const all = projectTasks.filter(task => task.groupId === story.id)
      const tasks = visibleTasks.filter(task => task.groupId === story.id)
      const block = all.filter(task => (task.sprintId ?? null) === sprintId)
      const empty = block.length === 0 && (story.sprintId ?? null) === sprintId
        && (all.length === 0 || story.sprintId != null)
        && (showCompleted || story.status !== 'done')
      if (tasks.length === 0 && !empty)
        return []
      return [{ story, epic, tasks, done: block.filter(task => task.completed).length, total: block.length }]
    }),
  )
}

/** Возвращает задачи без истории, включая задачи непосредственно в эпике. */
export function standaloneBacklogTasks(tasks: Task[], tree: BoardGroupNode[]): Task[] {
  const storyIds = new Set(tree.flatMap(epic => epic.children.map(story => story.id)))
  return tasks.filter(task => !task.groupId || !storyIds.has(task.groupId))
}
