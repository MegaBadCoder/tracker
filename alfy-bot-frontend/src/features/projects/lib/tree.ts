import type { Project, ProjectTreeNode } from '../model/types'

export function buildTree(projects: Project[]): ProjectTreeNode[] {
  const map = new Map<string, ProjectTreeNode>()

  for (const project of projects) {
    map.set(project.id, { ...project, children: [] })
  }

  const roots: ProjectTreeNode[] = []

  for (const node of map.values()) {
    if (node.parentId === null) {
      roots.push(node)
      continue
    }

    if (node.parentId === node.id) {
      console.warn('[projects/tree] Project has self parent and will be skipped', { projectId: node.id })
      continue
    }

    const parent = map.get(node.parentId)
    if (parent) {
      parent.children.push(node)
      continue
    }

    console.warn('[projects/tree] Project has unknown parent and will be skipped', {
      projectId: node.id,
      parentId: node.parentId,
    })
  }

  const sortByOrder = (a: ProjectTreeNode, b: ProjectTreeNode) => a.order - b.order
  const sortRecursive = (nodes: ProjectTreeNode[]) => {
    nodes.sort(sortByOrder)
    for (const node of nodes) {
      sortRecursive(node.children)
    }
  }

  sortRecursive(roots)
  return roots
}
