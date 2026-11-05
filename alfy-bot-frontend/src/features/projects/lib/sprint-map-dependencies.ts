import type { SprintMapNode } from './sprint-map'
import type { PositionedMapNode } from './sprint-map-layout'
import type { TaskDependencyEdge } from '@/features/tasks/model/task-dependencies'
import type { Task } from '@/features/tasks/model/types'

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

function routeDependencies(links: SprintMapDependency[], visibleNodes: PositionedMapNode[]): number {
  const lanes: { start: number, end: number, x: number }[] = []
  let minX = 0
  for (const link of links) {
    if (!link.from || !link.to)
      continue
    const source = { x: link.from.x - 9, y: link.from.y + link.from.height * 2 / 3 }
    const target = { x: link.to.x - 11, y: link.to.y + link.to.height / 3 }
    const interval = { start: Math.min(source.y, target.y) - 12, end: Math.max(source.y, target.y) + 12 }
    let laneX = Math.min(link.from.x, link.to.x) - 40
    while (true) {
      const obstacle = visibleNodes.find(item => laneX >= item.x - 12 && laneX <= item.x + item.width + 12 && interval.start <= item.y + item.height && interval.end >= item.y)
      if (obstacle) {
        laneX = obstacle.x - 24
        continue
      }
      if (lanes.some(item => Math.abs(item.x - laneX) < 18 && interval.start <= item.end && interval.end >= item.start)) {
        laneX -= 18
        continue
      }
      break
    }
    lanes.push({ ...interval, x: laneX })
    const direction = target.y >= source.y ? 1 : -1
    const radius = Math.min(12, Math.abs(target.y - source.y) / 2)
    link.sourcePort = source
    link.targetPort = target
    link.path = `M${source.x} ${source.y} H${laneX + radius} Q${laneX} ${source.y} ${laneX} ${source.y + direction * radius} V${target.y - direction * radius} Q${laneX} ${target.y} ${laneX + radius} ${target.y} H${target.x}`
    minX = Math.min(minX, laneX - 16)
  }
  return minX
}

/** Вычисляет ожидание по текущим задачам и направляет связи от предшественников к видимым узлам; внешние задачи остаются в списке без добавления в дерево. */
export function deriveSprintMapDependencies(input: SprintMapDependencyInput): { waiting: Map<string, number>, links: SprintMapDependency[], minX: number } {
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
  return { waiting, links, minX: routeDependencies(links, input.visibleNodes) }
}
