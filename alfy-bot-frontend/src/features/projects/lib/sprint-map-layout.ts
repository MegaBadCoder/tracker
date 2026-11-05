import type { SprintMapNode } from './sprint-map'

export const MAP_NODE_WIDTH = 264
export const MAP_NODE_HEIGHT = 156
export const MAP_COLUMN_GAP = 96
export const MAP_ROW_GAP = 32
export const MAP_PADDING = 48

export interface PositionedMapNode {
  node: SprintMapNode
  x: number
  y: number
  width: number
  height: number
}

export interface MapEdge {
  from: string
  to: string
  path: string
}

const columns: Record<SprintMapNode['kind'], number> = { task: 0, story: 1, epic: 2, ungrouped: 2, sprint: 3 }

/** Раскладывает видимые ветки по уровням в пикселях; свёрнутые узлы сохраняют исходные данные и занимают место одной карточки. */
export function layoutSprintMap(root: SprintMapNode, collapsed: ReadonlySet<string>): {
  nodes: PositionedMapNode[]
  edges: MapEdge[]
  width: number
  height: number
} {
  const nodes: PositionedMapNode[] = []
  const edges: MapEdge[] = []
  let nextY = MAP_PADDING

  function place(node: SprintMapNode): PositionedMapNode {
    const positioned: PositionedMapNode = {
      node,
      x: MAP_PADDING + columns[node.kind] * (MAP_NODE_WIDTH + MAP_COLUMN_GAP),
      y: nextY,
      width: MAP_NODE_WIDTH,
      height: MAP_NODE_HEIGHT,
    }
    nodes.push(positioned)
    const children = collapsed.has(node.key) ? [] : node.children.map(place)
    const first = children[0]
    const [last] = children.slice(-1)
    if (first && last)
      positioned.y = (first.y + last.y) / 2
    else
      nextY += MAP_NODE_HEIGHT + MAP_ROW_GAP

    for (const child of children) {
      const startX = child.x + child.width
      const startY = child.y + child.height / 2
      const endY = positioned.y + positioned.height / 2
      const bendX = positioned.x - MAP_COLUMN_GAP / 2
      edges.push({ from: child.node.key, to: node.key, path: `M${startX} ${startY} H${bendX} V${endY} H${positioned.x}` })
    }
    return positioned
  }

  place(root)
  return {
    nodes,
    edges,
    width: MAP_PADDING * 2 + 4 * MAP_NODE_WIDTH + 3 * MAP_COLUMN_GAP,
    height: nextY - MAP_ROW_GAP + MAP_PADDING,
  }
}
