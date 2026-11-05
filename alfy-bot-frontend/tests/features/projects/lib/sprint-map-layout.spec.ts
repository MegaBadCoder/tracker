import type { SprintMapNode } from '@/features/projects/lib/sprint-map'
import type { PositionedMapNode } from '@/features/projects/lib/sprint-map-layout'
import { describe, expect, it } from 'vitest'
import { layoutSprintMap, MAP_NODE_HEIGHT, MAP_NODE_WIDTH, MAP_PADDING, MAP_ROW_GAP } from '@/features/projects/lib/sprint-map-layout'

function node(kind: SprintMapNode['kind'], id: string, children: SprintMapNode[] = []): SprintMapNode {
  return { key: `${kind}:${id}`, kind, sourceId: id, title: id, statusLabel: '', statusCategory: 'open', statusColor: null, total: 4, done: 2, outsideCount: 0, blockedReason: null, releases: [], children }
}

function tree() {
  return node('sprint', 's', [node('epic', 'e', [node('story', 'a', [node('task', '1'), node('task', '2')]), node('story', 'b', [node('task', '3')]), node('task', 'direct')]), node('ungrouped', 'u', [node('task', '4')])])
}

function radius(item: PositionedMapNode, width: number, height: number) {
  return Math.hypot(item.x + item.width / 2 - width / 2, item.y + item.height / 2 - height / 2)
}

function expectSeparated(result: ReturnType<typeof layoutSprintMap>) {
  result.nodes.forEach((item, index) => {
    expect(item).toMatchObject({ width: MAP_NODE_WIDTH, height: MAP_NODE_HEIGHT })
    expect(item.x).toBeGreaterThanOrEqual(MAP_PADDING - 0.000001)
    expect(item.y).toBeGreaterThanOrEqual(MAP_PADDING - 0.000001)
    expect(item.x + item.width).toBeLessThanOrEqual(result.width - MAP_PADDING + 0.000001)
    expect(item.y + item.height).toBeLessThanOrEqual(result.height - MAP_PADDING + 0.000001)
    for (const other of result.nodes.slice(index + 1)) {
      const gapX = Math.abs(item.x - other.x) - MAP_NODE_WIDTH
      const gapY = Math.abs(item.y - other.y) - MAP_NODE_HEIGHT
      expect(Math.max(gapX, gapY), `${item.node.key} / ${other.node.key}`).toBeGreaterThanOrEqual(MAP_ROW_GAP - 0.000001)
    }
  })
}

function onBorder(point: number[], item: PositionedMapNode) {
  const [x = 0, y = 0] = point
  const horizontal = Math.abs(x - item.x) < 0.000001 || Math.abs(x - item.x - item.width) < 0.000001
  const vertical = Math.abs(y - item.y) < 0.000001 || Math.abs(y - item.y - item.height) < 0.000001
  expect(horizontal || vertical).toBe(true)
  expect(x).toBeGreaterThanOrEqual(item.x - 0.000001)
  expect(x).toBeLessThanOrEqual(item.x + item.width + 0.000001)
  expect(y).toBeGreaterThanOrEqual(item.y - 0.000001)
  expect(y).toBeLessThanOrEqual(item.y + item.height + 0.000001)
}

function segmentCrossesCard(start: number[], end: number[], card: PositionedMapNode): boolean {
  let enter = 0
  let exit = 1
  const bounds = [[card.x, card.x + card.width], [card.y, card.y + card.height]]
  for (let axis = 0; axis < 2; axis++) {
    const origin = start[axis]!
    const delta = end[axis]! - origin
    const [min = 0, max = 0] = bounds[axis]!
    if (Math.abs(delta) < 0.0000001) {
      if (origin <= min || origin >= max)
        return false
      continue
    }
    const first = (min - origin) / delta
    const second = (max - origin) / delta
    enter = Math.max(enter, Math.min(first, second))
    exit = Math.min(exit, Math.max(first, second))
  }
  return enter < exit
}

function expectEdgesInsideBounds(result: ReturnType<typeof layoutSprintMap>) {
  for (const edge of result.edges) {
    const coordinates = edge.path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number)
    for (let index = 0; index < coordinates.length; index += 2) {
      expect(coordinates[index], `${edge.from} x`).toBeGreaterThanOrEqual(MAP_PADDING - 0.000001)
      expect(coordinates[index], `${edge.from} x`).toBeLessThanOrEqual(result.width - MAP_PADDING + 0.000001)
      expect(coordinates[index + 1], `${edge.from} y`).toBeGreaterThanOrEqual(MAP_PADDING - 0.000001)
      expect(coordinates[index + 1], `${edge.from} y`).toBeLessThanOrEqual(result.height - MAP_PADDING + 0.000001)
    }
  }
}

function expectEdgesOutsideCards(result: ReturnType<typeof layoutSprintMap>) {
  const intersections = new Set<string>()
  for (const edge of result.edges) {
    const coordinates = edge.path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number)
    let x = coordinates[0]!
    let y = coordinates[1]!
    for (let index = 2; index < coordinates.length; index += 6) {
      const [ax = 0, ay = 0, bx = 0, by = 0, cx = 0, cy = 0] = coordinates.slice(index, index + 6)
      let previous = [x, y]
      for (let sample = 1; sample <= 64; sample++) {
        const t = sample / 64
        const pointX = (1 - t) ** 3 * x + 3 * (1 - t) ** 2 * t * ax + 3 * (1 - t) * t ** 2 * bx + t ** 3 * cx
        const pointY = (1 - t) ** 3 * y + 3 * (1 - t) ** 2 * t * ay + 3 * (1 - t) * t ** 2 * by + t ** 3 * cy
        for (const card of result.nodes) {
          if (card.node.key === edge.from || card.node.key === edge.to)
            continue
          if (segmentCrossesCard(previous, [pointX, pointY], card))
            intersections.add(`${edge.from} → ${edge.to} intersects ${card.node.key}`)
        }
        previous = [pointX, pointY]
      }
      x = cx
      y = cy
    }
  }
  expect([...intersections]).toEqual([])
}

describe('layoutSprintMap', () => {
  it('включает дуги редких веток в симметричные границы полотна с отступом', () => {
    for (const count of [2, 3, 5, 24]) {
      const root = node('sprint', 's', [node('epic', 'e', [node('story', 'a', Array.from({ length: count }, (_, index) => node('task', `${index}`)))])])
      const result = layoutSprintMap(root, new Set())
      expect(result.nodes[0]).toMatchObject({ x: result.width / 2 - MAP_NODE_WIDTH / 2, y: result.height / 2 - MAP_NODE_HEIGHT / 2 })
      expectEdgesInsideBounds(result)
    }
  })

  it('ведёт иерархию широкой одиночной ветки вокруг центральных карточек', () => {
    const root = node('sprint', 's', [node('epic', 'e', [node('story', 'a', Array.from({ length: 24 }, (_, index) => node('task', `${index}`)))])])
    expectEdgesOutsideCards(layoutSprintMap(root, new Set()))
  })

  it('располагает спринт в центре и семантическую глубину дерева на общих кольцах', () => {
    const result = layoutSprintMap(tree(), new Set())
    const byKey = new Map(result.nodes.map(item => [item.node.key, item]))
    expect(result.nodes).toHaveLength(10)
    expect(byKey.get('sprint:s')).toMatchObject({ x: result.width / 2 - MAP_NODE_WIDTH / 2, y: result.height / 2 - MAP_NODE_HEIGHT / 2 })
    const rings = [['sprint:s'], ['epic:e', 'ungrouped:u'], ['story:a', 'story:b', 'task:direct', 'task:4'], ['task:1', 'task:2', 'task:3']]
    let previousRadius = -1
    for (const keys of rings) {
      const distances = keys.map(key => radius(byKey.get(key)!, result.width, result.height))
      distances.forEach(distance => expect(distance).toBeCloseTo(distances[0]!, 6))
      expect(distances[0]).toBeGreaterThan(previousRadius)
      previousRadius = distances[0]!
    }
    expectSeparated(result)
  })

  it('распределяет соседние ветки по непрерывным секторам пропорционально видимым листьям', () => {
    const root = node('sprint', 's', [node('epic', 'large', Array.from({ length: 3 }, (_, index) => node('task', `${index}`))), node('epic', 'small')])
    const result = layoutSprintMap(root, new Set())
    const angle = (key: string) => {
      const item = result.nodes.find(item => item.node.key === key)!
      return Math.atan2(item.y + item.height / 2 - result.height / 2, item.x + item.width / 2 - result.width / 2)
    }
    expect(angle('epic:large')).toBeCloseTo(Math.PI / 4, 6)
    expect(angle('epic:small')).toBeCloseTo(-3 * Math.PI / 4, 6)
    expect(angle('task:0')).toBeCloseTo(-Math.PI / 4, 6)
    expect(angle('task:1')).toBeCloseTo(Math.PI / 4, 6)
    expect(angle('task:2')).toBeCloseTo(3 * Math.PI / 4, 6)
  })

  it('соединяет края карточек детей и родителей без стрелок', () => {
    const result = layoutSprintMap(tree(), new Set())
    expect(result.edges).toHaveLength(9)
    expect(result.edges.find(edge => edge.from === 'task:1')).toMatchObject({ to: 'story:a' })
    for (const edge of result.edges) {
      expect(edge.path).toMatch(/^M[-\d.e ]+(?: C[-\d.e ]+)+$/i)
      const coordinates = edge.path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number)
      onBorder(coordinates.slice(0, 2), result.nodes.find(item => item.node.key === edge.from)!)
      onBorder(coordinates.slice(-2), result.nodes.find(item => item.node.key === edge.to)!)
      expect(coordinates.every(Number.isFinite)).toBe(true)
    }
  })

  it('сворачивает потомков и уплотняет карту без изменения данных и прогресса', () => {
    const root = tree()
    const before = JSON.stringify(root)
    const result = layoutSprintMap(root, new Set(['epic:e']))
    expect(result.nodes.map(item => item.node.key).sort()).toEqual(['sprint:s', 'epic:e', 'ungrouped:u', 'task:4'].sort())
    expect(result.width * result.height).toBeLessThan(layoutSprintMap(root, new Set()).width * layoutSprintMap(root, new Set()).height)
    expect(result.nodes.find(item => item.node.key === 'epic:e')?.node).toMatchObject({ done: 2, total: 4 })
    expect(JSON.stringify(root)).toBe(before)
  })

  it('не перекрывает любые пары карточек при всех комбинациях свёрнутых веток', () => {
    const root = tree()
    const branches = ['sprint:s', 'epic:e', 'story:a', 'story:b', 'ungrouped:u']
    for (let mask = 0; mask < 2 ** branches.length; mask++) {
      const collapsed = new Set(branches.filter((_, index) => mask & (1 << index)))
      const result = layoutSprintMap(root, collapsed)
      expect(result.nodes.length).toBeGreaterThan(0)
      expectSeparated(result)
      expectEdgesOutsideCards(result)
      expectEdgesInsideBounds(result)
      expect(layoutSprintMap(root, collapsed)).toEqual(result)
    }
  })

  it('размещает 120 задач без наложений и сохраняет компактный обзор историй', () => {
    const stories: string[] = []
    const root = node('sprint', 'large', Array.from({ length: 6 }, (_, epic) => node('epic', `${epic}`, Array.from({ length: 4 }, (_, story) => {
      const id = `${epic}-${story}`
      stories.push(`story:${id}`)
      return node('story', id, Array.from({ length: 5 }, (_, task) => node('task', `${id}-${task}`)))
    }))))
    const expanded = layoutSprintMap(root, new Set())
    const overview = layoutSprintMap(root, new Set(stories))
    expect(expanded.nodes).toHaveLength(151)
    expect(overview.nodes).toHaveLength(31)
    expectSeparated(expanded)
    expectSeparated(overview)
    expectEdgesOutsideCards(expanded)
    expectEdgesOutsideCards(overview)
    expectEdgesInsideBounds(expanded)
    expectEdgesInsideBounds(overview)
    expect(Math.max(expanded.width, expanded.height)).toBeLessThan(16000)
    expect(Math.max(overview.width, overview.height)).toBeLessThan(4000)
    expect(overview.width * overview.height).toBeLessThan(expanded.width * expanded.height / 4)
  })

  it('разводит узкие соседние сектора несбалансированного дерева на разных глубинах', () => {
    const root = node('sprint', 'unbalanced', [node('epic', 'large', [node('story', 'many', Array.from({ length: 110 }, (_, index) => node('task', `${index}`))), node('story', 'small', [node('task', 'single')])]), node('epic', 'empty'), node('task', 'direct')])
    for (const collapsed of [new Set<string>(), new Set(['story:many']), new Set(['epic:large'])]) {
      const result = layoutSprintMap(root, collapsed)
      expectSeparated(result)
      expectEdgesOutsideCards(result)
      expectEdgesInsideBounds(result)
    }
  })

  it('поддерживает спринты без задач и с одной прямой задачей', () => {
    for (const children of [[], [node('task', 'only')]]) {
      const result = layoutSprintMap(node('sprint', 's', children), new Set())
      expect(result.nodes).toHaveLength(children.length + 1)
      expect(result.edges).toHaveLength(children.length)
      expectSeparated(result)
    }
  })

  it('показывает пустой или свёрнутый спринт одной центральной карточкой', () => {
    for (const root of [node('sprint', 's'), tree()]) {
      const result = layoutSprintMap(root, new Set(['sprint:s']))
      expect(result.nodes).toHaveLength(1)
      expect(result.edges).toEqual([])
      expect(result.width).toBe(MAP_NODE_WIDTH + 2 * MAP_PADDING)
      expect(result.height).toBe(MAP_NODE_HEIGHT + 2 * MAP_PADDING)
      expect(result.nodes[0]).toMatchObject({ x: MAP_PADDING, y: MAP_PADDING })
    }
  })
})
