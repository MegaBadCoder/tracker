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

interface RadialNode {
  node: SprintMapNode
  children: RadialNode[]
  leaves: number
  angle: number
  x: number
  y: number
}

const GEOMETRY_EPSILON = 0.0000001
const MAP_RING_GAP = Math.hypot(MAP_NODE_WIDTH, MAP_NODE_HEIGHT) + MAP_ROW_GAP

interface Point { x: number, y: number }
type CubicCurve = [Point, Point, Point]
interface EdgeGeometry { start: Point, curves: CubicCurve[] }

function axisInterval(direction: number, center: number, clearance: number): [number, number] | null {
  if (Math.abs(direction) < GEOMETRY_EPSILON)
    return Math.abs(center) < clearance ? [-Infinity, Infinity] : null
  const first = (center - clearance) / direction
  const second = (center + clearance) / direction
  return [Math.min(first, second), Math.max(first, second)]
}

function collisionInterval(node: RadialNode, inner: RadialNode): [number, number] | null {
  const x = axisInterval(Math.cos(node.angle), inner.x, MAP_NODE_WIDTH + MAP_ROW_GAP)
  const y = axisInterval(Math.sin(node.angle), inner.y, MAP_NODE_HEIGHT + MAP_ROW_GAP)
  if (!x || !y)
    return null
  const start = Math.max(x[0], y[0])
  const end = Math.min(x[1], y[1])
  return start < end ? [start, end] : null
}

function ringRadius(ring: RadialNode[], inner: RadialNode[], previousRadius: number): number {
  let radius = previousRadius + MAP_RING_GAP
  ring.forEach((node, index) => {
    for (const other of ring.slice(index + 1)) {
      const x = Math.abs(Math.cos(node.angle) - Math.cos(other.angle))
      const y = Math.abs(Math.sin(node.angle) - Math.sin(other.angle))
      radius = Math.max(radius, Math.min((MAP_NODE_WIDTH + MAP_ROW_GAP) / x, (MAP_NODE_HEIGHT + MAP_ROW_GAP) / y))
    }
  })
  const intervals = ring.flatMap(node => inner.map(other => collisionInterval(node, other)).filter((interval): interval is [number, number] => interval !== null))
  intervals.sort((a, b) => a[0] - b[0])
  for (const [start, end] of intervals) {
    if (radius < start)
      break
    if (radius <= end)
      radius = end + GEOMETRY_EPSILON
  }
  return radius + GEOMETRY_EPSILON
}

function radialPoint(center: Point, radius: number, angle: number): Point {
  return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
}

function borderRadius(angle: number): number {
  return Math.min(MAP_NODE_WIDTH / 2 / Math.abs(Math.cos(angle)), MAP_NODE_HEIGHT / 2 / Math.abs(Math.sin(angle)))
}

function straightCurve(start: Point, end: Point): CubicCurve {
  const dx = (end.x - start.x) / 3
  const dy = (end.y - start.y) / 3
  return [{ x: start.x + dx, y: start.y + dy }, { x: end.x - dx, y: end.y - dy }, end]
}

function edgeGeometry(child: RadialNode, parent: RadialNode): EdgeGeometry {
  const center = { x: 0, y: 0 }
  const childRadius = Math.hypot(child.x, child.y)
  const parentRadius = Math.hypot(parent.x, parent.y)
  const parentAngle = parentRadius === 0 ? child.angle : parent.angle
  const start = radialPoint(center, childRadius - borderRadius(child.angle), child.angle)
  const end = radialPoint(center, parentRadius + borderRadius(parentAngle), parentAngle)
  if (parentRadius === 0)
    return { start, curves: [straightCurve(start, end)] }

  const radius = (childRadius + parentRadius) / 2
  const first = radialPoint(center, radius, child.angle)
  const curves: CubicCurve[] = [straightCurve(start, first)]
  const steps = Math.ceil(Math.abs(parentAngle - child.angle) / (Math.PI / 8))
  let angle = child.angle
  for (let step = 1; step <= steps; step++) {
    const nextAngle = child.angle + (parentAngle - child.angle) * step / steps
    const a = radialPoint(center, radius, angle)
    const b = radialPoint(center, radius, nextAngle)
    const tangent = 4 / 3 * Math.tan((nextAngle - angle) / 4) * radius
    curves.push([{ x: a.x - tangent * Math.sin(angle), y: a.y + tangent * Math.cos(angle) }, { x: b.x + tangent * Math.sin(nextAngle), y: b.y - tangent * Math.cos(nextAngle) }, b])
    angle = nextAngle
  }
  curves.push(straightCurve(radialPoint(center, radius, parentAngle), end))
  return { start, curves }
}

function edgePath(geometry: EdgeGeometry, center: Point): string {
  const coordinates = (point: Point) => `${point.x + center.x} ${point.y + center.y}`
  return `M${coordinates(geometry.start)}${geometry.curves.map(curve => ` C${curve.map(coordinates).join(' ')}`).join('')}`
}

/** Размещает видимые узлы на кольцах по глубине дерева в пикселях; центр спринта совпадает с центром полотна, карточки разделены отступом и сохраняют исходные данные. */
export function layoutSprintMap(root: SprintMapNode, collapsed: ReadonlySet<string>): {
  nodes: PositionedMapNode[]
  edges: MapEdge[]
  width: number
  height: number
} {
  const rings: RadialNode[][] = []
  const radialNodes: RadialNode[] = []

  function collect(node: SprintMapNode, depth: number): RadialNode {
    const entry: RadialNode = { node, children: [], leaves: 1, angle: 0, x: 0, y: 0 }
    radialNodes.push(entry)
    const ring = rings[depth] ??= []
    ring.push(entry)
    entry.children = collapsed.has(node.key) ? [] : node.children.map(child => collect(child, depth + 1))
    entry.leaves = Math.max(1, entry.children.reduce((total, child) => total + child.leaves, 0))
    return entry
  }

  function assignSectors(node: RadialNode, start: number, span: number) {
    node.angle = start + span / 2
    let childStart = start
    for (const child of node.children) {
      const childSpan = span * child.leaves / node.leaves
      assignSectors(child, childStart, childSpan)
      childStart += childSpan
    }
  }

  const rootEntry = collect(root, 0)
  assignSectors(rootEntry, -Math.PI / 2, Math.PI * 2)
  const inner = [rootEntry]
  let previousRadius = 0
  for (const ring of rings.slice(1)) {
    const radius = ringRadius(ring, inner, previousRadius)
    for (const node of ring) {
      node.x = radius * Math.cos(node.angle)
      node.y = radius * Math.sin(node.angle)
    }
    inner.push(...ring)
    previousRadius = radius
  }

  const connections = radialNodes.flatMap(parent => parent.children.map(child => ({ from: child.node.key, to: parent.node.key, geometry: edgeGeometry(child, parent) })))
  const edgePoints = connections.flatMap(({ geometry }) => [geometry.start, ...geometry.curves.flat()])
  const halfWidth = Math.max(...radialNodes.map(node => Math.abs(node.x) + MAP_NODE_WIDTH / 2), ...edgePoints.map(point => Math.abs(point.x))) + MAP_PADDING
  const halfHeight = Math.max(...radialNodes.map(node => Math.abs(node.y) + MAP_NODE_HEIGHT / 2), ...edgePoints.map(point => Math.abs(point.y))) + MAP_PADDING
  const nodes = radialNodes.map(({ node, x, y }) => ({ node, x: x + halfWidth - MAP_NODE_WIDTH / 2, y: y + halfHeight - MAP_NODE_HEIGHT / 2, width: MAP_NODE_WIDTH, height: MAP_NODE_HEIGHT }))
  const center = { x: halfWidth, y: halfHeight }
  const edges = connections.map(({ from, to, geometry }) => ({ from, to, path: edgePath(geometry, center) }))
  return { nodes, edges, width: halfWidth * 2, height: halfHeight * 2 }
}
