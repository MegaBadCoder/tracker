import { describe, expect, it } from 'vitest'
import { buildTree } from '@/features/projects/lib/tree'
import { flattenProjects, projectDestination } from '@/features/projects/lib/project-tree-drag'
import type { Project } from '@/features/projects/model/types'

const projects = [['a', null], ['b', null], ['c', 'a'], ['d', 'c']].map(([id, parentId], order) => ({ id, parentId, order, title: id })) as Project[]
const tree = buildTree(projects)

describe('проекция дерева', () => {
  it('исключает переносимый проект и всех потомков', () => {
    expect(flattenProjects(tree, new Set(), 'a').map(row => row.node.id)).toEqual(['b'])
  })
  it('уважает свёрнутые ветки', () => {
    expect(flattenProjects(tree, new Set(['a']), null).map(row => row.node.id)).toEqual(['a', 'b'])
  })
  it('правый отступ делает проект ребёнком предыдущей строки', () => {
    const rows = flattenProjects(tree, new Set(['a']), 'b')
    expect(projectDestination(rows, 1, 1)).toMatchObject({ parentId: 'a', beforeId: null, depth: 1 })
  })
  it('левый отступ выносит проект после всей родительской ветки', () => {
    const rows = flattenProjects(tree, new Set(), 'd')
    expect(projectDestination(rows, 2, 0)).toMatchObject({ parentId: null, beforeId: 'b', depth: 0 })
  })
  it('не разбивает оставшихся потомков при выходе в корень', () => {
    const rows = flattenProjects(tree, new Set(), 'b')
    expect(projectDestination(rows, 1, 0)).toMatchObject({ parentId: null, beforeId: null, index: 3 })
  })
  it('не вкладывает первый проект и ограничивает отступ соседями', () => {
    const rows = flattenProjects(tree, new Set(), 'b')
    expect(projectDestination(rows, 0, 9)).toMatchObject({ parentId: null, beforeId: 'a', depth: 0 })
    expect(projectDestination(rows, 1, 9)).toMatchObject({ parentId: 'a', beforeId: 'c', depth: 1 })
  })
})
