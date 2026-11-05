import type { SprintMapNode } from '@/features/projects/lib/sprint-map'
import { describe, expect, it } from 'vitest'
import { layoutSprintMap, MAP_COLUMN_GAP, MAP_NODE_HEIGHT, MAP_NODE_WIDTH, MAP_PADDING, MAP_ROW_GAP } from '@/features/projects/lib/sprint-map-layout'

function node(kind: SprintMapNode['kind'], id: string, children: SprintMapNode[] = []): SprintMapNode {
  return { key: `${kind}:${id}`, kind, sourceId: id, title: id, statusLabel: '', statusCategory: 'open', statusColor: null, total: 4, done: 2, outsideCount: 0, blockedReason: null, releases: [], children }
}

function tree() {
  return node('sprint', 's', [node('epic', 'e', [node('story', 'a', [node('task', '1'), node('task', '2')]), node('story', 'b', [node('task', '3')]), node('task', 'direct')]), node('ungrouped', 'u', [node('task', '4')])])
}

describe('layoutSprintMap', () => {
  it('размещает уровни слева направо и соединяет детей с родителями', () => {
    const result = layoutSprintMap(tree(), new Set())
    expect(result.nodes).toHaveLength(10)
    const columns = { task: 0, story: 1, epic: 2, ungrouped: 2, sprint: 3 }
    for (const item of result.nodes) {
      expect(item.x).toBe(MAP_PADDING + columns[item.node.kind] * (MAP_NODE_WIDTH + MAP_COLUMN_GAP))
      expect(item).toMatchObject({ width: MAP_NODE_WIDTH, height: MAP_NODE_HEIGHT })
      expect(item.y).toBeGreaterThanOrEqual(MAP_PADDING)
      expect(item.x + item.width).toBeLessThanOrEqual(result.width - MAP_PADDING)
      expect(item.y + item.height).toBeLessThanOrEqual(result.height - MAP_PADDING)
    }
    expect(result.edges).toHaveLength(9)
    expect(result.edges.find(edge => edge.from === 'task:1')).toMatchObject({ to: 'story:a' })
    expect(result.edges.every(edge => /^M[\d .-]+ H[\d .-]+ V[\d .-]+ H[\d .-]+$/.test(edge.path))).toBe(true)
  })

  it('сворачивает потомков и уплотняет карту без изменения данных и прогресса', () => {
    const root = tree()
    const before = JSON.stringify(root)
    const result = layoutSprintMap(root, new Set(['epic:e']))
    expect(result.nodes.map(item => item.node.key).sort()).toEqual(['sprint:s', 'epic:e', 'ungrouped:u', 'task:4'].sort())
    expect(result.height).toBeLessThan(layoutSprintMap(root, new Set()).height)
    expect(result.nodes.find(item => item.node.key === 'epic:e')?.node).toMatchObject({ done: 2, total: 4 })
    expect(JSON.stringify(root)).toBe(before)
  })

  it('не перекрывает карточки одного уровня при любых свёрнутых ветках', () => {
    const root = tree()
    const branches = ['sprint:s', 'epic:e', 'story:a', 'story:b', 'ungrouped:u']
    for (let mask = 0; mask < 2 ** branches.length; mask++) {
      const collapsed = new Set(branches.filter((_, index) => mask & (1 << index)))
      const result = layoutSprintMap(root, collapsed)
      expect(result.nodes.length).toBeGreaterThan(0)
      for (const item of result.nodes) {
        for (const other of result.nodes) {
          if (item.node.key !== other.node.key && item.x === other.x)
            expect(Math.abs(item.y - other.y)).toBeGreaterThanOrEqual(MAP_NODE_HEIGHT + MAP_ROW_GAP)
        }
      }
      expect(layoutSprintMap(root, collapsed)).toEqual(result)
    }
  })

  it('показывает пустой или свёрнутый спринт одной карточкой', () => {
    for (const root of [node('sprint', 's'), tree()]) {
      const result = layoutSprintMap(root, new Set(['sprint:s']))
      expect(result.nodes).toHaveLength(1)
      expect(result.edges).toEqual([])
      expect(result.height).toBe(MAP_NODE_HEIGHT + 2 * MAP_PADDING)
    }
  })
})
