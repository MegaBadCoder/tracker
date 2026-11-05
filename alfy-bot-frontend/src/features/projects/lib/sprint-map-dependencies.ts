import type { SprintMapNode } from './sprint-map'
import type { SprintMapDependencyBounds } from './sprint-map-dependency-routing'
import type { PositionedMapNode } from './sprint-map-layout'
import type { TaskDependencyEdge } from '@/features/tasks/model/task-dependencies'
import type { Task } from '@/features/tasks/model/types'
import { routeSprintMapDependencies } from './sprint-map-dependency-routing'

export interface SprintMapDependency extends TaskDependencyEdge {
  predecessor: Task | null
  dependent: Task | null
  from: PositionedMapNode | null
  to: PositionedMapNode | null
  predecessorHidden: boolean
  dependentHidden: boolean
  completed: boolean
  path: string | null
  sourcePort: { x: number, y: number } | null
  targetPort: { x: number, y: number } | null
}

export interface SprintMapDependencyInput {
  root: SprintMapNode
  visibleNodes: PositionedMapNode[]
  tasks: Task[]
  dependencies: TaskDependencyEdge[]
  selectedTaskId: string | null
  showAll: boolean
}

function taskEndpoints(root: SprintMapNode, visibleNodes: PositionedMapNode[]) {
  const visible = new Map(visibleNodes.map(item => [item.node.key, item]))
  const endpoints = new Map<string, PositionedMapNode>()
  function visit(node: SprintMapNode, ancestor: PositionedMapNode | undefined) {
    const endpoint = visible.get(node.key) ?? ancestor
    if (node.kind === 'task' && node.sourceId && endpoint)
      endpoints.set(node.sourceId, endpoint)
    node.children.forEach(child => visit(child, endpoint))
  }
  visit(root, undefined)
  return endpoints
}

/** Вычисляет ожидание по текущим задачам и направляет связи от предшественников к видимым узлам; внешние задачи остаются в списке без добавления в дерево. */
export function deriveSprintMapDependencies(input: SprintMapDependencyInput): { waiting: Map<string, number>, links: SprintMapDependency[], minX: number, bounds: SprintMapDependencyBounds } {
  const tasks = new Map(input.tasks.map(task => [task.id, task]))
  const endpoints = taskEndpoints(input.root, input.visibleNodes)
  const waiting = new Map<string, number>()
  const links: SprintMapDependency[] = []
  for (const edge of input.dependencies) {
    const predecessor = tasks.get(edge.dependencyId) ?? null
    const dependent = tasks.get(edge.taskId) ?? null
    if (!predecessor || !dependent)
      continue
    const completed = predecessor.completed
    waiting.set(edge.taskId, (waiting.get(edge.taskId) ?? 0) + (completed ? 0 : 1))
    const from = endpoints.get(edge.dependencyId) ?? null
    const to = endpoints.get(edge.taskId) ?? null
    if ((!from && !to) || (!input.showAll && edge.taskId !== input.selectedTaskId && edge.dependencyId !== input.selectedTaskId))
      continue
    links.push({
      ...edge,
      predecessor,
      dependent,
      from,
      to,
      completed,
      predecessorHidden: !!from && from.node.key !== `task:${edge.dependencyId}`,
      dependentHidden: !!to && to.node.key !== `task:${edge.taskId}`,
      path: null,
      sourcePort: null,
      targetPort: null,
    })
  }
  links.sort((a, b) => a.dependencyId.localeCompare(b.dependencyId) || a.taskId.localeCompare(b.taskId))
  const bounds = routeSprintMapDependencies(links, input.visibleNodes)
  return { waiting, links, minX: Math.min(0, bounds.minX), bounds }
}
