import type { SprintMapNode } from '@/features/projects/lib/sprint-map'
import { describe, expect, it } from 'vitest'
import { layoutSprintMap, MAP_NODE_HEIGHT, MAP_NODE_WIDTH, MAP_PADDING, MAP_ROW_GAP } from '@/features/projects/lib/sprint-map-layout'

function node(kind: SprintMapNode['kind'], id: string, children: SprintMapNode[] = []): SprintMapNode {
  return { key: `${kind}:${id}`, kind, sourceId: id, title: id, statusLabel: '', statusCategory: 'open', statusColor: null, total: 4, done: 2, outsideCount: 0, blockedReason: null, releases: [], children }
}
function tree() {
  return node('sprint', 's', [node('epic', 'e', [node('story', 'a', [node('task', '1'), node('task', '2')]), node('story', 'b', [node('task', '3')]), node('task', 'direct')]), node('ungrouped', 'u', [node('task', '4')])])
}
function assertGeometry(result: ReturnType<typeof layoutSprintMap>) {
  const root = result.nodes[0]!
  expect(root.x + root.width / 2).toBe(result.width / 2)
  expect(root.y + root.height / 2).toBe(result.height / 2)
  for (const [index, card] of result.nodes.entries()) {
    expect(card.x).toBeGreaterThanOrEqual(MAP_PADDING)
    expect(card.y).toBeGreaterThanOrEqual(MAP_PADDING)
    expect(card.x + card.width).toBeLessThanOrEqual(result.width - MAP_PADDING)
    expect(card.y + card.height).toBeLessThanOrEqual(result.height - MAP_PADDING)
    for (const other of result.nodes.slice(index + 1))
      expect(Math.max(Math.abs(card.x - other.x) - card.width, Math.abs(card.y - other.y) - card.height)).toBeGreaterThanOrEqual(MAP_ROW_GAP)
  }
  for (const edge of result.edges) {
    expect(edge.path).toMatch(/^M[-\d.]+ [-\d.]+ H[-\d.]+ V[-\d.]+ H[-\d.]+$/)
    const [x = 0, y = 0, trunk = 0, targetY = 0, targetX = 0] = edge.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    for (const card of result.nodes) {
      if (card.node.key === edge.from || card.node.key === edge.to)
        continue
      const horizontal = (a: number, b: number, atY: number) => atY > card.y && atY < card.y + card.height && Math.max(a, b) > card.x && Math.min(a, b) < card.x + card.width
      const vertical = trunk > card.x && trunk < card.x + card.width && Math.max(y, targetY) > card.y && Math.min(y, targetY) < card.y + card.height
      expect(horizontal(x, trunk, y) || vertical || horizontal(trunk, targetX, targetY), `${edge.from} crosses ${card.node.key}`).toBe(false)
    }
  }
}

describe('mind map спринта', () => {
  it('распределяет эпики по обе стороны центра, а потомков направляет наружу', () => {
    const result = layoutSprintMap(tree(), new Set())
    const byKey = new Map(result.nodes.map(item => [item.node.key, item]))
    const root = byKey.get('sprint:s')!
    expect((byKey.get('epic:e')!.x - root.x) * (byKey.get('ungrouped:u')!.x - root.x)).toBeLessThan(0)
    for (const [childKey, parentKey] of [['story:a', 'epic:e'], ['task:1', 'story:a'], ['task:4', 'ungrouped:u']]) {
      const child = byKey.get(childKey!)!
      const parent = byKey.get(parentKey!)!
      expect(Math.abs(child.x - root.x)).toBeGreaterThan(Math.abs(parent.x - root.x))
      expect(Math.sign(child.x - root.x)).toBe(Math.sign(parent.x - root.x))
    }
    assertGeometry(result)
  })
  it('соединяет соседние истории общим стволом', () => {
    const result = layoutSprintMap(tree(), new Set())
    const first = result.edges.find(edge => edge.from === 'story:a')!
    const second = result.edges.find(edge => edge.from === 'story:b')!
    expect(first.to).toBe('epic:e')
    expect(first.path.match(/H[-\d.]+/)?.[0]).toBe(second.path.match(/H[-\d.]+/)?.[0])
    expect(first.path.match(/V[-\d.]+ H[-\d.]+$/)?.[0]).toBe(second.path.match(/V[-\d.]+ H[-\d.]+$/)?.[0])
    expect(result.edges).toHaveLength(result.nodes.length - 1)
  })
  it('сохраняет стороны при сворачивании и не меняет данные', () => {
    const root = tree()
    const snapshot = JSON.stringify(root)
    const expanded = layoutSprintMap(root, new Set())
    const collapsed = layoutSprintMap(root, new Set(['epic:e']))
    for (const key of ['epic:e', 'ungrouped:u']) {
      const side = (layout: typeof expanded) => Math.sign(layout.nodes.find(item => item.node.key === key)!.x - layout.width / 2 + MAP_NODE_WIDTH / 2)
      expect(side(collapsed)).toBe(side(expanded))
    }
    expect(collapsed.nodes).toHaveLength(4)
    expect(collapsed.height).toBeLessThan(expanded.height)
    expect(JSON.stringify(root)).toBe(snapshot)
  })
  it('не допускает пересечений при всех комбинациях свёрнутых веток', () => {
    const root = tree()
    const branches = ['sprint:s', 'epic:e', 'story:a', 'story:b', 'ungrouped:u']
    for (let mask = 0; mask < 2 ** branches.length; mask++) {
      const collapsed = new Set(branches.filter((_, index) => mask & (1 << index)))
      const result = layoutSprintMap(root, collapsed)
      assertGeometry(result)
      expect(layoutSprintMap(root, collapsed)).toEqual(result)
    }
  })
  it('разводит 120 задач и несбалансированные ветви', () => {
    const root = node('sprint', 'large', Array.from({ length: 6 }, (_, epic) => node('epic', `${epic}`, Array.from({ length: 4 }, (_, story) => node('story', `${epic}-${story}`, Array.from({ length: 5 }, (_, task) => node('task', `${epic}-${story}-${task}`)))))))
    const result = layoutSprintMap(root, new Set())
    expect(result.nodes).toHaveLength(151)
    assertGeometry(result)
    assertGeometry(layoutSprintMap(node('sprint', 'unbalanced', [node('epic', 'many', [node('story', 'large', Array.from({ length: 110 }, (_, index) => node('task', `${index}`)))]), node('epic', 'small')]), new Set()))
  })
  it('распределяет неодинаковые ветки по ближайшему равному числу листьев', () => {
    const root = node('sprint', 'balanced', [8, 7, 6, 5, 4].map((count, epic) => node('epic', `${epic}`, Array.from({ length: count }, (_, task) => node('task', `${epic}-${task}`)))))
    const result = layoutSprintMap(root, new Set())
    const center = result.width / 2
    const counts = [1, -1].map(side => result.nodes.filter(item => item.node.kind === 'task' && Math.sign(item.x + item.width / 2 - center) === side).length)
    expect(counts).toEqual([15, 15])
    assertGeometry(result)
  })
  it('находит ближайший допустимый баланс, не разделяя целые ветки', () => {
    for (const weights of [[11, 3, 2], [2, 2, 3, 3, 5], [1, 1, 1, 1, 10, 6, 2]]) {
      const root = node('sprint', 'balance', weights.map((count, epic) => node('epic', `${epic}`, Array.from({ length: count }, (_, task) => node('task', `${epic}-${task}`)))))
      const result = layoutSprintMap(root, new Set())
      const total = weights.reduce((sum, value) => sum + value, 0)
      const possibleDifferences = Array.from({ length: 2 ** weights.length }, (_, mask) => Math.abs(total - 2 * weights.reduce((sum, value, index) => sum + (mask & (1 << index) ? value : 0), 0)))
      const right = result.nodes.filter(item => item.node.kind === 'task' && item.x > result.width / 2).length
      expect(Math.abs(total - 2 * right)).toBe(Math.min(...possibleDifferences))
      expect(result.nodes.filter(item => item.node.kind === 'task')).toHaveLength(total)
      assertGeometry(result)
    }
  })
  it('равномерно распределяет видимые ветки по общей высоте обеих сторон', () => {
    const root = node('sprint', 'balanced', [8, 7, 6, 5, 4].map((count, epic) => node('epic', `${epic}`, Array.from({ length: count }, (_, task) => node('task', `${epic}-${task}`)))))
    const collapsed = new Set(root.children.map(child => child.key))
    const result = layoutSprintMap(root, collapsed)
    const groups = [1, -1].map(side => result.nodes.filter(item => item.node.kind === 'epic' && Math.sign(item.x + item.width / 2 - result.width / 2) === side))
    expect(groups.map(group => Math.min(...group.map(item => item.y)))[0]).toBe(groups.map(group => Math.min(...group.map(item => item.y)))[1])
    expect(groups.map(group => Math.max(...group.map(item => item.y + item.height)))[0]).toBe(groups.map(group => Math.max(...group.map(item => item.y + item.height)))[1])
    assertGeometry(result)
  })
  it('оставляет пустой и свёрнутый спринт одной центральной карточкой', () => {
    for (const root of [node('sprint', 'empty'), tree()]) {
      const result = layoutSprintMap(root, new Set([root.key]))
      expect(result.nodes).toHaveLength(1)
      expect(result.edges).toEqual([])
      expect(result.width).toBe(MAP_NODE_WIDTH + 2 * MAP_PADDING)
      expect(result.height).toBe(MAP_NODE_HEIGHT + 2 * MAP_PADDING)
      assertGeometry(result)
    }
  })
})
