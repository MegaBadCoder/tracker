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

interface BranchNode {
  node: SprintMapNode
  children: BranchNode[]
  span: number
  weight: number
}

function collectBranch(node: SprintMapNode, collapsed: ReadonlySet<string>): BranchNode {
  const allChildren = node.children.map(child => collectBranch(child, collapsed))
  const children = collapsed.has(node.key) ? [] : allChildren
  return {
    node,
    children,
    weight: Math.max(1, allChildren.reduce((sum, child) => sum + child.weight, 0)),
    span: Math.max(MAP_NODE_HEIGHT, children.reduce((sum, child) => sum + child.span, 0) + Math.max(0, children.length - 1) * MAP_ROW_GAP),
  }
}

function forestSpan(nodes: BranchNode[]): number {
  return nodes.reduce((sum, node) => sum + node.span, 0) + Math.max(0, nodes.length - 1) * MAP_ROW_GAP
}

function branchPath(child: PositionedMapNode, parent: PositionedMapNode, side: number): string {
  const startX = side > 0 ? child.x : child.x + child.width
  const endX = side > 0 ? parent.x + parent.width : parent.x
  const trunkX = (startX + endX) / 2
  return `M${startX} ${child.y + child.height / 2} H${trunkX} V${parent.y + parent.height / 2} H${endX}`
}

/** Размещает спринт в центре, распределяет полные ветки по сторонам и соединяет их общими ортогональными стволами; координаты и размеры заданы в пикселях, сворачивание не меняет исходные узлы и стороны веток. */
export function layoutSprintMap(root: SprintMapNode, collapsed: ReadonlySet<string>): {
  nodes: PositionedMapNode[]
  edges: MapEdge[]
  width: number
  height: number
} {
  const tree = collectBranch(root, collapsed)
  const sides = [{ direction: 1, weight: 0, branches: [] as BranchNode[] }, { direction: -1, weight: 0, branches: [] as BranchNode[] }]
  for (const branch of tree.children) {
    const side = sides[0]!.weight <= sides[1]!.weight ? sides[0]! : sides[1]!
    side.branches.push(branch)
    side.weight += branch.weight
  }
  const nodes: PositionedMapNode[] = [{ node: root, x: -MAP_NODE_WIDTH / 2, y: -MAP_NODE_HEIGHT / 2, width: MAP_NODE_WIDTH, height: MAP_NODE_HEIGHT }]
  const connections: { child: PositionedMapNode, parent: PositionedMapNode, side: number }[] = []

  function place(branch: BranchNode, parent: PositionedMapNode, side: number, depth: number, top: number) {
    const positioned = { node: branch.node, x: side * depth * (MAP_NODE_WIDTH + MAP_COLUMN_GAP) - MAP_NODE_WIDTH / 2, y: top + branch.span / 2 - MAP_NODE_HEIGHT / 2, width: MAP_NODE_WIDTH, height: MAP_NODE_HEIGHT }
    nodes.push(positioned)
    connections.push({ child: positioned, parent, side })
    let childTop = top
    for (const child of branch.children) {
      place(child, positioned, side, depth + 1, childTop)
      childTop += child.span + MAP_ROW_GAP
    }
  }

  for (const side of sides) {
    let top = -forestSpan(side.branches) / 2
    for (const branch of side.branches) {
      place(branch, nodes[0]!, side.direction, 1, top)
      top += branch.span + MAP_ROW_GAP
    }
  }
  const halfWidth = Math.max(...nodes.map(node => Math.abs(node.x + node.width / 2) + node.width / 2)) + MAP_PADDING
  const halfHeight = Math.max(...nodes.map(node => Math.abs(node.y + node.height / 2) + node.height / 2)) + MAP_PADDING
  for (const node of nodes) {
    node.x += halfWidth
    node.y += halfHeight
  }
  const edges = connections.map(({ child, parent, side }) => ({ from: child.node.key, to: parent.node.key, path: branchPath(child, parent, side) }))
  return { nodes, edges, width: halfWidth * 2, height: halfHeight * 2 }
}
