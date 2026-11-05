import type { PositionedMapNode } from './sprint-map-layout'

interface Point { x: number, y: number }
interface Rectangle { left: number, top: number, right: number, bottom: number }
interface Endpoint { port: Point, anchor: Point }
interface RoutedLink {
  from: PositionedMapNode | null
  to: PositionedMapNode | null
  sourcePort: Point | null
  targetPort: Point | null
  path: string | null
}
interface QueueEntry { index: number, distance: number, priority: number }

export interface SprintMapDependencyBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function rectangle(node: PositionedMapNode, clearance: number): Rectangle {
  return { left: node.x - clearance, top: node.y - clearance, right: node.x + node.width + clearance, bottom: node.y + node.height + clearance }
}

function crosses(a: Point, b: Point, obstacle: Rectangle) {
  return a.y === b.y
    ? a.y > obstacle.top && a.y < obstacle.bottom && Math.max(a.x, b.x) > obstacle.left && Math.min(a.x, b.x) < obstacle.right
    : a.x > obstacle.left && a.x < obstacle.right && Math.max(a.y, b.y) > obstacle.top && Math.min(a.y, b.y) < obstacle.bottom
}

function endpoint(node: PositionedMapNode, nodes: PositionedMapNode[], source: boolean, lane: number): Endpoint | null {
  const offset = source ? 9 : 11
  const y = node.y + node.height * (source ? 2 / 3 : 1 / 3)
  const x = node.x + node.width * (source ? 2 / 3 : 1 / 3)
  const obstacles = nodes.filter(item => item !== node).map(item => rectangle(item, 7))
  for (const distance of [28 + lane * 8, 28]) {
    const candidates = [
      { port: { x: node.x - offset, y }, anchor: { x: node.x - distance, y } },
      { port: { x: node.x + node.width + offset, y }, anchor: { x: node.x + node.width + distance, y } },
      { port: { x, y: node.y - offset }, anchor: { x, y: node.y - distance } },
      { port: { x, y: node.y + node.height + offset }, anchor: { x, y: node.y + node.height + distance } },
    ]
    for (const candidate of candidates) {
      if (obstacles.every(item => !crosses(candidate.port, candidate.anchor, item)))
        return candidate
    }
  }
  return null
}

function push(queue: QueueEntry[], entry: QueueEntry) {
  let index = queue.length
  queue.push(entry)
  while (index > 0) {
    const parent = (index - 1) >> 1
    if (queue[parent]!.priority <= entry.priority)
      break
    queue[index] = queue[parent]!
    index = parent
  }
  queue[index] = entry
}

function pop(queue: QueueEntry[]): QueueEntry {
  const result = queue[0]!
  const last = queue.pop()!
  if (!queue.length)
    return result
  let index = 0
  while (index * 2 + 1 < queue.length) {
    let child = index * 2 + 1
    if (child + 1 < queue.length && queue[child + 1]!.priority < queue[child]!.priority)
      child++
    if (queue[child]!.priority >= last.priority)
      break
    queue[index] = queue[child]!
    index = child
  }
  queue[index] = last
  return result
}

function findRoute(source: Endpoint, target: Endpoint, nodes: PositionedMapNode[], clearance: number): Point[] | null {
  const start = source.anchor
  const end = target.anchor
  const obstacles = nodes.map(item => rectangle(item, clearance))
  const xs = [...new Set([start.x, end.x, ...obstacles.flatMap(item => [item.left, item.right])])].sort((a, b) => a - b)
  const ys = [...new Set([start.y, end.y, ...obstacles.flatMap(item => [item.top, item.bottom])])].sort((a, b) => a - b)
  const width = xs.length
  const count = width * ys.length
  const xIndices = new Map(xs.map((value, index) => [value, index]))
  const yIndices = new Map(ys.map((value, index) => [value, index]))
  const horizontal = new Uint8Array(count)
  const vertical = new Uint8Array(count)
  for (const obstacle of obstacles) {
    const left = xIndices.get(obstacle.left)!
    const right = xIndices.get(obstacle.right)!
    const top = yIndices.get(obstacle.top)!
    const bottom = yIndices.get(obstacle.bottom)!
    for (let row = top + 1; row < bottom; row++)
      horizontal.fill(1, row * width + left, row * width + right)
    for (let row = top; row < bottom; row++)
      vertical.fill(1, row * width + left + 1, row * width + right)
  }
  const first = yIndices.get(start.y)! * width + xIndices.get(start.x)!
  const last = yIndices.get(end.y)! * width + xIndices.get(end.x)!
  const distances = new Float64Array(count).fill(Number.POSITIVE_INFINITY)
  const previous = new Int32Array(count).fill(-1)
  const queue: QueueEntry[] = []
  distances[first] = 0
  push(queue, { index: first, distance: 0, priority: Math.abs(start.x - end.x) + Math.abs(start.y - end.y) })
  while (queue.length) {
    const current = pop(queue)
    if (current.distance !== distances[current.index])
      continue
    if (current.index === last) {
      const path: Point[] = []
      for (let index = last; index !== -1; index = previous[index]!)
        path.push({ x: xs[index % width]!, y: ys[Math.floor(index / width)]! })
      return path.reverse()
    }
    const column = current.index % width
    const row = Math.floor(current.index / width)
    const neighbors = [
      column > 0 && !horizontal[current.index - 1] ? current.index - 1 : -1,
      row > 0 && !vertical[current.index - width] ? current.index - width : -1,
      row + 1 < ys.length && !vertical[current.index] ? current.index + width : -1,
      column + 1 < width && !horizontal[current.index] ? current.index + 1 : -1,
    ]
    for (const neighbor of neighbors) {
      if (neighbor < 0)
        continue
      const horizontalMove = Math.floor(neighbor / width) === row
      if (current.index === first && horizontalMove === (source.port.y === source.anchor.y))
        continue
      if (neighbor === last && horizontalMove === (target.port.y === target.anchor.y))
        continue
      const x = xs[neighbor % width]!
      const y = ys[Math.floor(neighbor / width)]!
      const distance = current.distance + Math.abs(xs[column]! - x) + Math.abs(ys[row]! - y)
      if (distance >= distances[neighbor]!)
        continue
      distances[neighbor] = distance
      previous[neighbor] = current.index
      push(queue, { index: neighbor, distance, priority: distance + Math.abs(x - end.x) + Math.abs(y - end.y) })
    }
  }
  return null
}

function simplify(points: Point[]) {
  const result: Point[] = []
  for (const point of points) {
    const lastIndex = result.length - 1
    const last = result[lastIndex]
    if (last?.x === point.x && last.y === point.y)
      continue
    const before = result[result.length - 2]
    if (before && last && ((before.x === last.x && last.x === point.x) || (before.y === last.y && last.y === point.y)))
      result.pop()
    result.push(point)
  }
  return result
}

function roundedPath(points: Point[]) {
  let path = `M${points[0]!.x} ${points[0]!.y}`
  const line = (from: Point, to: Point) => from.x === to.x ? ` V${to.y}` : ` H${to.x}`
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]!
    const point = points[index]!
    const next = points[index + 1]
    if (!next) {
      path += line(previous, point)
      continue
    }
    const radius = Math.min(6, (Math.abs(previous.x - point.x) + Math.abs(previous.y - point.y)) / 2, (Math.abs(next.x - point.x) + Math.abs(next.y - point.y)) / 2)
    const before = { x: point.x + Math.sign(previous.x - point.x) * radius, y: point.y + Math.sign(previous.y - point.y) * radius }
    const after = { x: point.x + Math.sign(next.x - point.x) * radius, y: point.y + Math.sign(next.y - point.y) * radius }
    path += `${line(previous, before)} Q${point.x} ${point.y} ${after.x} ${after.y}`
  }
  return path
}

/** Прокладывает направленные ортогональные связи вне видимых карточек и возвращает их границы в пикселях с запасом для маркеров. */
export function routeSprintMapDependencies(links: RoutedLink[], nodes: PositionedMapNode[]): SprintMapDependencyBounds {
  let bounds: SprintMapDependencyBounds | null = null
  links.forEach((link, index) => {
    if (!link.from || !link.to)
      return
    const source = endpoint(link.from, nodes, true, index)
    const target = endpoint(link.to, nodes, false, index)
    if (!source || !target)
      return
    const route = findRoute(source, target, nodes, 12) ?? findRoute(source, target, nodes, 4)
    if (!route)
      return
    const points = simplify([source.port, source.anchor, ...route, target.anchor, target.port])
    link.sourcePort = source.port
    link.targetPort = target.port
    link.path = roundedPath(points)
    for (const point of points) {
      bounds ??= { minX: point.x - 16, minY: point.y - 16, maxX: point.x + 16, maxY: point.y + 16 }
      bounds.minX = Math.min(bounds.minX, point.x - 16)
      bounds.minY = Math.min(bounds.minY, point.y - 16)
      bounds.maxX = Math.max(bounds.maxX, point.x + 16)
      bounds.maxY = Math.max(bounds.maxY, point.y + 16)
    }
  })
  return bounds ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 }
}
