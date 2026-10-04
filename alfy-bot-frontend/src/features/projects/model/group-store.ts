import type { BoardGroup, BoardGroupNode, CreateGroupPayload, GroupType, UpdateGroupPayload } from './types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as groupsApi from '../api/groups-api'
import { findGroup } from '../lib/group-tree'

function replaceNode(
  nodes: BoardGroupNode[],
  id: string,
  updater: (node: BoardGroupNode) => BoardGroupNode,
): BoardGroupNode[] {
  return nodes.map((node) => {
    if (node.id === id)
      return updater(node)
    return { ...node, children: replaceNode(node.children, id, updater) }
  })
}

function removeNode(nodes: BoardGroupNode[], id: string): BoardGroupNode[] {
  return nodes
    .filter(node => node.id !== id)
    .map(node => ({ ...node, children: removeNode(node.children, id) }))
}

export const useGroupStore = defineStore('groups', () => {
  const trees = ref<Record<string, BoardGroupNode[]>>({})
  const loadingProjects = ref<Set<string>>(new Set())
  const error = ref<string | null>(null)

  function groupsOf(projectId: string): BoardGroupNode[] {
    return trees.value[projectId] ?? []
  }

  function isLoading(projectId: string): boolean {
    return loadingProjects.value.has(projectId)
  }

  const fetchGroups = async (projectId: string) => {
    loadingProjects.value.add(projectId)
    error.value = null

    try {
      const { data } = await groupsApi.fetchGroups(projectId)
      trees.value[projectId] = data
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка загрузки эпиков'
    }
    finally {
      loadingProjects.value.delete(projectId)
    }
  }

  async function ensureGroups(projectId: string): Promise<void> {
    if (projectId in trees.value || isLoading(projectId))
      return
    await fetchGroups(projectId)
  }

  const createGroup = async (projectId: string, payload: CreateGroupPayload) => {
    const parentId = payload.parentId ?? null
    const type: GroupType = parentId ? 'story' : 'epic'
    const tempId = `temp-${Date.now()}`
    const tree = trees.value[projectId] ?? []
    const siblings = parentId ? (findGroup(tree, parentId)?.children ?? []) : tree
    const tempNode: BoardGroupNode = {
      id: tempId,
      projectId,
      parentId,
      type,
      title: payload.title,
      description: payload.description ?? null,
      status: 'open',
      completedAt: null,
      releaseId: null,
      color: payload.color ?? null,
      startDate: payload.startDate ?? null,
      dueDate: payload.dueDate ?? null,
      order: siblings.length,
      children: [],
    }

    trees.value[projectId] = parentId
      ? replaceNode(tree, parentId, node => ({
          ...node,
          children: [...node.children, tempNode],
        }))
      : [...tree, tempNode]

    try {
      const { data } = await groupsApi.createGroup(projectId, payload)
      const newNode: BoardGroupNode = { ...data, children: [] }
      const current = trees.value[projectId] ?? []

      trees.value[projectId] = parentId
        ? replaceNode(current, parentId, node => ({
            ...node,
            children: node.children.map(child => (child.id === tempId ? newNode : child)),
          }))
        : current.map(node => (node.id === tempId ? newNode : node))

      return data
    }
    catch (err) {
      const current = trees.value[projectId] ?? []
      trees.value[projectId] = parentId
        ? replaceNode(current, parentId, node => ({
            ...node,
            children: node.children.filter(child => child.id !== tempId),
          }))
        : current.filter(node => node.id !== tempId)
      throw err
    }
  }

  const updateGroup = async (projectId: string, groupId: string, payload: UpdateGroupPayload) => {
    const tree = trees.value[projectId] ?? []
    const previous = tree
    const target = findGroup(tree, groupId)
    if (!target)
      return

    trees.value[projectId] = replaceNode(tree, groupId, node => ({ ...node, ...payload }))

    try {
      const { data } = await groupsApi.updateGroup(projectId, groupId, payload)
      trees.value[projectId] = replaceNode(trees.value[projectId] ?? [], groupId, node => ({ ...node, ...data }))
      return data
    }
    catch (err) {
      trees.value[projectId] = previous
      throw err
    }
  }

  const deleteGroup = async (projectId: string, groupId: string) => {
    const tree = trees.value[projectId] ?? []
    const previous = tree
    const target = findGroup(tree, groupId)
    if (!target)
      return

    trees.value[projectId] = removeNode(tree, groupId)

    try {
      await groupsApi.deleteGroup(projectId, groupId)
    }
    catch (err) {
      trees.value[projectId] = previous
      throw err
    }
  }

  const reorderGroups = async (projectId: string, orderedIds: string[]) => {
    const tree = trees.value[projectId] ?? []
    const previous = tree
    const firstId = orderedIds[0]
    const isRootLevel = tree.some(node => node.id === firstId)

    if (isRootLevel) {
      trees.value[projectId] = orderedIds
        .map((id, i) => {
          const node = tree.find(n => n.id === id)
          return node ? { ...node, order: i } : null
        })
        .filter((n): n is BoardGroupNode => n !== null)
    }
    else {
      const parent = tree.find(epic => epic.children.some(child => child.id === firstId))
      if (parent) {
        trees.value[projectId] = replaceNode(tree, parent.id, node => ({
          ...node,
          children: orderedIds
            .map((id, i) => {
              const child = node.children.find(c => c.id === id)
              return child ? { ...child, order: i } : null
            })
            .filter((c): c is BoardGroupNode => c !== null),
        }))
      }
    }

    try {
      await groupsApi.reorderGroups(projectId, orderedIds)
    }
    catch (err) {
      trees.value[projectId] = previous
      throw err
    }
  }

  const toggleGroupDone = async (projectId: string, group: BoardGroup) => {
    const nextStatus: 'open' | 'done' = group.status === 'done' ? 'open' : 'done'
    return updateGroup(projectId, group.id, { status: nextStatus })
  }

  return {
    trees,
    error,
    groupsOf,
    isLoading,
    fetchGroups,
    ensureGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    reorderGroups,
    toggleGroupDone,
  }
})
