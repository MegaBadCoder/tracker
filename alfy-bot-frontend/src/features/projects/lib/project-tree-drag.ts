import type { ProjectTreeNode } from '../model/types'

export const PROJECT_INDENT = 20
export interface ProjectTreeRow { node: ProjectTreeNode, depth: number }
export interface ProjectDestination { parentId: string | null, beforeId: string | null, depth: number, index: number }

/** Возвращает видимые строки дерева, исключая переносимую ветку целиком. */
export function flattenProjects(nodes: ProjectTreeNode[], collapsed: Set<string>, excludedId: string | null): ProjectTreeRow[] {
  const result: ProjectTreeRow[] = []
  const visit = (items: ProjectTreeNode[], depth: number) => {
    for (const node of items) {
      if (node.id === excludedId)
        continue
      result.push({ node, depth })
      if (!collapsed.has(node.id))
        visit(node.children, depth + 1)
    }
  }
  visit(nodes, 0)
  return result
}

/** Вычисляет родителя и соседа по месту вставки и желаемой глубине; index относится к строкам без переносимой ветки. */
export function projectDestination(rows: ProjectTreeRow[], index: number, desiredDepth: number): ProjectDestination {
  const previous = rows[index - 1]
  const depth = Math.max(0, Math.min(desiredDepth, previous ? previous.depth + 1 : 0))
  const parent = depth === 0 ? null : rows.slice(0, index).reverse().find(row => row.depth === depth - 1)
  const parentId = parent?.node.id ?? null
  while (rows[index] && rows[index]!.depth > depth) index++
  const next = rows[index]
  const beforeId = next?.depth === depth && next.node.parentId === parentId ? next.node.id : null
  return { parentId, beforeId, depth, index }
}
