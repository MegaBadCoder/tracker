import type { BoardGroupNode, ProjectColumn, Release, Sprint, StoryWorkflowStatus } from '../model/types'
import type { Task } from '@/features/tasks/model/types'

export interface SprintMapNode {
  key: string
  kind: 'sprint' | 'epic' | 'story' | 'task' | 'ungrouped'
  sourceId: string | null
  title: string
  statusLabel: string
  statusCategory: string
  statusColor: string | null
  done: number
  total: number
  outsideCount: number
  blockedReason: string | null
  releaseNames: string[]
  children: SprintMapNode[]
}

export interface SprintMapInput {
  projectId: string
  sprint: Sprint
  groups: BoardGroupNode[]
  tasks: Task[]
  columns: ProjectColumn[]
  workflow: StoryWorkflowStatus[]
  releases: Release[]
}

function ordered<T extends { id: string, order?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
}

function summary(children: SprintMapNode[]) {
  return {
    total: children.reduce((sum, child) => sum + child.total, 0),
    done: children.reduce((sum, child) => sum + child.done, 0),
    outsideCount: children.reduce((sum, child) => sum + child.outsideCount, 0),
  }
}

/** Строит дерево выбранного спринта без изменения исходных сущностей; прогресс учитывает уникальные задачи только его проекта и спринта. */
export function buildSprintMap(input: SprintMapInput): SprintMapNode {
  const { projectId, sprint, workflow } = input
  if (sprint.projectId !== projectId)
    throw new Error('Спринт принадлежит другому проекту')

  const tasks = ordered([...new Map(input.tasks.filter(task => task.projectId === projectId).map(task => [task.id, task])).values()])
  const selectedTasks = tasks.filter(task => task.sprintId === sprint.id)
  const releases = new Map(input.releases.filter(release => release.projectId === projectId).map(release => [release.id, release]))
  const columns = new Map(input.columns.filter(column => column.projectId === projectId).map(column => [column.id, column]))
  const claimedGroups = new Set<string>()
  const claimedTasks = new Set<string>()

  function releaseNames(releaseId?: string | null): string[] {
    const release = releaseId ? releases.get(releaseId) : undefined
    return release ? [release.name] : []
  }

  function taskNode(task: Task): SprintMapNode {
    claimedTasks.add(task.id)
    const column = task.columnId ? columns.get(task.columnId) : undefined
    return {
      key: `task:${task.id}`,
      kind: 'task',
      sourceId: task.id,
      title: task.title,
      statusLabel: task.completed ? 'Выполнена' : column?.title ?? 'Без колонки',
      statusCategory: task.completed ? 'done' : 'open',
      statusColor: task.completed ? null : column?.color ?? null,
      done: task.completed ? 1 : 0,
      total: 1,
      outsideCount: 0,
      blockedReason: null,
      releaseNames: releaseNames(task.releaseId),
      children: [],
    }
  }

  function groupNode(group: BoardGroupNode): SprintMapNode | null {
    if (group.projectId !== projectId || claimedGroups.has(group.id))
      return null
    claimedGroups.add(group.id)
    const nested = ordered(group.children).map(groupNode).filter((node): node is SprintMapNode => node !== null)
    const children = [...nested, ...selectedTasks.filter(task => task.groupId === group.id && !claimedTasks.has(task.id)).map(taskNode)]
    const descendantIds = new Set<string>()
    function collectIds(current: BoardGroupNode) {
      if (current.projectId !== projectId || descendantIds.has(current.id))
        return
      descendantIds.add(current.id)
      current.children.forEach(collectIds)
    }
    collectIds(group)
    const outsideCount = tasks.filter(task => task.sprintId !== sprint.id && task.groupId && descendantIds.has(task.groupId)).length
    if (children.length === 0 && !(group.type === 'story' && group.sprintId === sprint.id))
      return null
    const status = group.type === 'story'
      ? workflow.find(status => status.id === group.workflowStatusId)
      ?? workflow.find(status => status.category === (group.status === 'done' ? 'done' : 'open'))
      : undefined
    return {
      key: `${group.type}:${group.id}`,
      kind: group.type,
      sourceId: group.id,
      title: group.title,
      statusLabel: status?.name ?? (group.status === 'done' ? (group.type === 'story' ? 'Выполнена' : 'Выполнен') : (group.type === 'story' ? 'Открыта' : 'Открыт')),
      statusCategory: status?.category ?? (group.status === 'done' ? 'done' : 'open'),
      statusColor: status?.color ?? group.color,
      ...summary(children),
      outsideCount,
      blockedReason: group.blockedReason ?? null,
      releaseNames: releaseNames(group.releaseId),
      children,
    }
  }

  const children = ordered(input.groups).map(groupNode).filter((node): node is SprintMapNode => node !== null)
  const ungroupedTasks = selectedTasks.filter(task => !claimedTasks.has(task.id)).map(taskNode)
  if (ungroupedTasks.length) {
    children.push({
      key: `ungrouped:${sprint.id}`,
      kind: 'ungrouped',
      sourceId: null,
      title: 'Без эпика',
      statusLabel: '',
      statusCategory: 'open',
      statusColor: null,
      ...summary(ungroupedTasks),
      blockedReason: null,
      releaseNames: [],
      children: ungroupedTasks,
    })
  }
  return {
    key: `sprint:${sprint.id}`,
    kind: 'sprint',
    sourceId: sprint.id,
    title: sprint.name,
    statusLabel: { planned: 'Запланирован', active: 'Активный', closed: 'Завершён' }[sprint.status],
    statusCategory: { planned: 'open', active: 'in_progress', closed: 'done' }[sprint.status],
    statusColor: null,
    ...summary(children),
    blockedReason: null,
    releaseNames: [],
    children,
  }
}

/** Возвращает все узлы в порядке обхода от родителя к детям, включая скрываемые на полотне ветки. */
export function flattenSprintMap(root: SprintMapNode): SprintMapNode[] {
  return [root, ...root.children.flatMap(flattenSprintMap)]
}
