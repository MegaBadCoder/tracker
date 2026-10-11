import type { BoardGroupNode } from '../model/types'
import type { Task } from '@/features/tasks/model/types'

export interface AgileStoryRow {
  story: BoardGroupNode
  tasks: Task[]
}

export interface AgileEpicRow {
  kind: 'epic'
  epic: BoardGroupNode
  stories: AgileStoryRow[]
  epicTasks: Task[]
}

export interface AgileUngroupedRow {
  kind: 'ungrouped'
  tasks: Task[]
}

export type AgileRow = AgileEpicRow | AgileUngroupedRow

export function buildAgileRows(groups: BoardGroupNode[], tasks: Task[]): AgileRow[] {
  const sortedEpics = [...groups].sort((a, b) => a.order - b.order)

  const knownGroupIds = new Set<string>()
  for (const epic of sortedEpics) {
    knownGroupIds.add(epic.id)
    for (const story of epic.children) {
      knownGroupIds.add(story.id)
    }
  }

  const rows: AgileRow[] = sortedEpics.map((epic) => {
    const sortedStories = [...epic.children].sort((a, b) => a.order - b.order)
    const stories: AgileStoryRow[] = sortedStories.map(story => ({
      story,
      tasks: tasks.filter(task => task.groupId === story.id),
    }))
    const epicTasks = tasks.filter(task => task.groupId === epic.id)

    return { kind: 'epic', epic, stories, epicTasks }
  })

  const ungroupedTasks = tasks.filter(
    task => !task.groupId || !knownGroupIds.has(task.groupId),
  )
  rows.push({ kind: 'ungrouped', tasks: ungroupedTasks })

  return rows
}

/**
 * Groups tasks by their columnId, preserving `null` (no column assigned)
 * as an explicit map key so those tasks are never dropped.
 */
export function groupTasksByColumn(tasks: Task[]): Map<string | null, Task[]> {
  const map = new Map<string | null, Task[]>()
  for (const task of tasks) {
    const key = task.columnId ?? null
    const arr = map.get(key) ?? []
    arr.push(task)
    map.set(key, arr)
  }
  return map
}
