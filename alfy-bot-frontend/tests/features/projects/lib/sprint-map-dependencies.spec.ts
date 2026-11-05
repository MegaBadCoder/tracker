import type { SprintMapNode } from '@/features/projects/lib/sprint-map'
import type { PositionedMapNode } from '@/features/projects/lib/sprint-map-layout'
import type { Task } from '@/features/tasks/model/types'
import { describe, expect, it } from 'vitest'
import { deriveSprintMapDependencies } from '@/features/projects/lib/sprint-map-dependencies'
import { layoutSprintMap } from '@/features/projects/lib/sprint-map-layout'

function positioned(id: string, x: number, y: number, width = 264, height = 156): PositionedMapNode {
  return { node: node('task', id), x, y, width, height }
}

function samplePath(path: string): { x: number, y: number }[] {
  const points: { x: number, y: number }[] = []
  let current = { x: 0, y: 0 }
  for (const match of path.matchAll(/([MHVQ])([^MHVQ]+)/g)) {
    const values = match[2]!.trim().split(/[ ,]+/).map(Number)
    const start = current
    if (match[1] === 'M') {
      current = { x: values[0]!, y: values[1]! }
      points.push(current)
      continue
    }
    const end = match[1] === 'Q' ? { x: values[2]!, y: values[3]! } : { x: match[1] === 'H' ? values[0]! : current.x, y: match[1] === 'V' ? values[0]! : current.y }
    for (let step = 1; step <= 100; step++) {
      const t = step / 100
      points.push(match[1] === 'Q'
        ? { x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * values[0]! + t ** 2 * end.x, y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * values[1]! + t ** 2 * end.y }
        : { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t })
    }
    current = end
  }
  return points
}

function expectClearPath(path: string, nodes: PositionedMapNode[]) {
  for (const point of samplePath(path))
    expect(nodes.some(item => point.x > item.x && point.x < item.x + item.width && point.y > item.y && point.y < item.y + item.height)).toBe(false)
}

function node(kind: SprintMapNode['kind'], id: string, children: SprintMapNode[] = []): SprintMapNode {
  return { key: `${kind}:${id}`, kind, sourceId: id, title: id, statusLabel: '', statusCategory: 'open', statusColor: null, done: 0, total: kind === 'task' ? 1 : 2, outsideCount: 0, blockedReason: null, releases: [], children }
}
const root = node('sprint', 's', [node('story', 'a', [node('task', 'a')]), node('story', 'b', [node('task', 'b')])])
const tasks: Task[] = [
  { id: 'a', title: 'Подготовить', completed: false, projectId: 'p', sprintId: 's' },
  { id: 'b', title: 'Проверить', completed: false, projectId: 'p', sprintId: 's' },
  { id: 'outside', title: 'Внешняя работа', completed: false, projectId: 'other', sprintId: 'next' },
]
const dependencies = [{ taskId: 'b', dependencyId: 'a' }, { taskId: 'b', dependencyId: 'outside' }]

function derive(selectedTaskId: string | null, showAll: boolean, collapsed = new Set<string>(), currentTasks = tasks) {
  return deriveSprintMapDependencies({ root, visibleNodes: layoutSprintMap(root, collapsed).nodes, tasks: currentTasks, dependencies, selectedTaskId, showAll })
}

describe('связи карты', () => {
  it('обходит препятствие на горизонтальной ножке в произвольной раскладке', () => {
    const visibleNodes = [positioned('a', 500, 0), positioned('b', 500, 400), positioned('obstacle', 430, 80, 30)]
    const result = deriveSprintMapDependencies({ root, visibleNodes, tasks, dependencies, selectedTaskId: 'b', showAll: false })
    expectClearPath(result.links[0]!.path!, visibleNodes)
  })

  it('меняет сторону порта, когда соседняя карточка закрывает левый выход', () => {
    const visibleNodes = [positioned('a', 500, 0), positioned('b', 500, 400), positioned('obstacle', 225, 0)]
    const result = deriveSprintMapDependencies({ root, visibleNodes, tasks, dependencies, selectedTaskId: 'b', showAll: false })
    const link = result.links[0]!
    expectClearPath(link.path!, visibleNodes)
    expect(link.sourcePort!.x).toBeGreaterThan(link.from!.x + link.from!.width)
  })

  it('возвращает границы путей и маркеров по обеим осям', () => {
    const visibleNodes = [positioned('a', -20, -100), positioned('b', 400, -100)]
    const result = deriveSprintMapDependencies({ root, visibleNodes, tasks, dependencies, selectedTaskId: 'b', showAll: false })
    for (const point of samplePath(result.links[0]!.path!)) {
      expect(point.x).toBeGreaterThanOrEqual(result.bounds.minX + 6)
      expect(point.y).toBeGreaterThanOrEqual(result.bounds.minY + 6)
      expect(point.x).toBeLessThanOrEqual(result.bounds.maxX - 6)
      expect(point.y).toBeLessThanOrEqual(result.bounds.maxY - 6)
    }
    expect(result.minX).toBe(result.bounds.minX)
    expect(derive(null, false).bounds).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 })
  })

  it('сохраняет обход карточек для нескольких связей на карте из ста задач', () => {
    const ids = Array.from({ length: 100 }, (_, index) => `task-${index}`)
    const largeRoot = node('sprint', 'large', ids.map(id => node('task', id)))
    const visibleNodes = ids.map((id, index) => positioned(id, (index % 10) * 330, Math.floor(index / 10) * 210))
    const edges = [9, 24, 57, 80, 99].map(index => ({ dependencyId: ids[0]!, taskId: ids[index]! }))
    const input = { root: largeRoot, visibleNodes, tasks: ids.map(id => ({ ...tasks[0]!, id })), dependencies: edges, selectedTaskId: ids[0]!, showAll: false }
    const result = deriveSprintMapDependencies(input)
    expect(result.links).toHaveLength(edges.length)
    for (const link of result.links) {
      expect(link.path).toBeTruthy()
      expectClearPath(link.path!, visibleNodes)
    }
    expect(deriveSprintMapDependencies({ ...input, visibleNodes: [...visibleNodes].reverse(), dependencies: [...edges].reverse() }).links.map(link => link.path)).toEqual(result.links.map(link => link.path))
  })
  it('считает ожидание без изменения дерева и скрывает линии до выбора', () => {
    const snapshot = JSON.stringify(root)
    const result = derive(null, false)
    expect(result.waiting.get('b')).toBe(2)
    expect(result.links).toEqual([])
    expect(JSON.stringify(root)).toBe(snapshot)
  })

  it('направляет связь от предшественника к зависимой задаче', () => {
    const result = derive('b', false)
    expect(result.links[0]).toMatchObject({ dependencyId: 'a', taskId: 'b', from: { node: { key: 'task:a' } }, to: { node: { key: 'task:b' } }, completed: false })
    expect(result.links[0]?.path).toMatch(/^M/)
  })

  it('сохраняет реальную задачу при проекции на видимого предка', () => {
    const result = derive('b', false, new Set(['story:a']))
    expect(result.links[0]).toMatchObject({ predecessor: { title: 'Подготовить' }, from: { node: { key: 'story:a' } }, predecessorHidden: true })
    expect(result.links[0]?.path).toBeTruthy()
  })

  it('оставляет внешний источник в списке без фиктивного узла', () => {
    const result = derive('b', false)
    expect(result.links[1]).toMatchObject({ predecessor: { title: 'Внешняя работа', projectId: 'other' }, from: null, path: null })
    expect(layoutSprintMap(root, new Set()).nodes).toHaveLength(5)
  })

  it('снимает ожидание по живому completed без изменения зависимой задачи', () => {
    const result = derive('b', false, new Set(), tasks.map(task => task.id === 'b' ? task : { ...task, completed: true }))
    expect(result.waiting.get('b')).toBe(0)
    expect(result.links.every(link => link.completed)).toBe(true)
    expect(tasks[1]?.completed).toBe(false)
  })

  it('показывает все связи и входящие для выбранного предшественника', () => {
    expect(derive(null, true).links).toHaveLength(2)
    expect(derive('a', false).links.map(link => link.dependencyId)).toEqual(['a'])
  })

  it('не оставляет ожидание от удалённого предшественника в полном снимке задач', () => {
    const result = derive('b', false, new Set(), tasks.filter(task => task.id !== 'a'))
    expect(result.waiting.get('b')).toBe(1)
    expect(result.links.map(link => link.dependencyId)).toEqual(['outside'])
  })

  it('не теряет связь внутри общей свёрнутой ветки', () => {
    const result = derive('b', false, new Set(['sprint:s']))
    expect(result.links[0]?.from?.node.key).toBe('sprint:s')
    expect(result.links[0]?.to?.node.key).toBe('sprint:s')
    expect(result.links[0]?.path).toBeTruthy()
  })

  it('оставляет наконечник и начало вне карточек, подходит к цели горизонтально', () => {
    const visibleNodes = [positioned('a', 500, 0), positioned('b', 500, 400)]
    const link = deriveSprintMapDependencies({ root, visibleNodes, tasks, dependencies, selectedTaskId: 'b', showAll: false }).links[0]!
    expect(link.sourcePort!.x).toBeLessThan(link.from!.x - 5)
    expect(link.targetPort!.x).toBeLessThan(link.to!.x - 5)
    expect(link.path).toMatch(/H[-\d.]+$/)
    expect(link.path).toContain('Q')
    expect(link.sourcePort!.y).toBeGreaterThan(link.from!.y + link.from!.height / 2)
    expect(link.targetPort!.y).toBeLessThan(link.to!.y + link.to!.height / 2)
  })

  it('разводит пересекающиеся связи по стабильным дорожкам и учитывает их в границах', () => {
    const multiRoot = node('sprint', 's', [node('story', 'story', ['a', 'b', 'c', 'd', 'e'].map(id => node('task', id)))])
    const multiTasks = ['a', 'b', 'c', 'd', 'e'].map(id => ({ ...tasks[0]!, id }))
    const edges = ['b', 'c', 'd', 'e'].map(taskId => ({ taskId, dependencyId: 'a' }))
    const input = { root: multiRoot, visibleNodes: layoutSprintMap(multiRoot, new Set()).nodes, tasks: multiTasks, dependencies: edges, selectedTaskId: null, showAll: true }
    const result = deriveSprintMapDependencies(input)
    expect(new Set(result.links.map(link => link.path)).size).toBe(4)
    for (const link of result.links)
      expectClearPath(link.path!, input.visibleNodes)
    expect(result.minX).toBe(Math.min(0, result.bounds.minX))
    expect(deriveSprintMapDependencies({ ...input, dependencies: [...edges].reverse() }).links.map(link => link.path)).toEqual(result.links.map(link => link.path))
  })

  it('обходит карточки между свёрнутыми историями при нескольких дорожках', () => {
    const sources = ['a1', 'a2', 'a3', 'a4', 'a5']
    const targets = ['z1', 'z2', 'z3', 'z4', 'z5']
    const obstacleRoot = node('sprint', 's', [
      node('story', 'first', sources.map(id => node('task', id))),
      node('story', 'middle', [node('task', 'middle')]),
      node('story', 'last', targets.map(id => node('task', id))),
    ])
    const visibleNodes = layoutSprintMap(obstacleRoot, new Set(['story:first', 'story:last'])).nodes
    const result = deriveSprintMapDependencies({ root: obstacleRoot, visibleNodes, tasks: [...sources, ...targets, 'middle'].map(id => ({ ...tasks[0]!, id })), dependencies: sources.map((id, index) => ({ dependencyId: id, taskId: targets[index]! })), selectedTaskId: null, showAll: true })
    for (const link of result.links) {
      expect(link.path).toBeTruthy()
      expectClearPath(link.path!, visibleNodes)
    }
    expect(new Set(result.links.map(link => link.path)).size).toBe(5)
  })
})
