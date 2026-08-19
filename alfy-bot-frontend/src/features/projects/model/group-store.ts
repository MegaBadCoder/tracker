import type { BoardGroup, BoardGroupNode, CreateGroupPayload, UpdateGroupPayload } from './types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as groupsApi from '../api/groups-api'

function findNode(nodes: BoardGroupNode[], id: string): BoardGroupNode | undefined {
  for (const node of nodes) {
    if (node.id === id)
      return node
    const found = findNode(node.children, id)
    if (found)
      return found
  }
  return undefined
}

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
  const groups = ref<BoardGroupNode[]>([])
  const currentProjectId = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchGroups = async (projectId: string) => {
    loading.value = true
    error.value = null
    currentProjectId.value = projectId

    try {
      const { data } = await groupsApi.fetchGroups(projectId)
      groups.value = data
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка загрузки эпиков'
    }
    finally {
      loading.value = false
    }
  }

  const createGroup = async (projectId: string, payload: CreateGroupPayload) => {
    const parentId = payload.parentId ?? null
    const type: 'epic' | 'story' = parentId ? 'story' : 'epic'
    const tempId = `temp-${Date.now()}`
    const siblings = parentId ? (findNode(groups.value, parentId)?.children ?? []) : groups.value
    const tempNode: BoardGroupNode = {
      id: tempId,
      projectId,
      parentId,
      type,
      title: payload.title,
      description: payload.description ?? null,
      status: 'open',
      completedAt: null,
      color: payload.color ?? null,
      order: siblings.length,
      children: [],
    }

    if (parentId) {
      groups.value = replaceNode(groups.value, parentId, node => ({
        ...node,
        children: [...node.children, tempNode],
      }))
    }
    else {
      groups.value = [...groups.value, tempNode]
    }

    try {
      const { data } = await groupsApi.createGroup(projectId, payload)
      const newNode: BoardGroupNode = { ...data, children: [] }

      if (parentId) {
        groups.value = replaceNode(groups.value, parentId, node => ({
          ...node,
          children: node.children.map(child => (child.id === tempId ? newNode : child)),
        }))
      }
      else {
        groups.value = groups.value.map(node => (node.id === tempId ? newNode : node))
      }

      return data
    }
    catch (err) {
      if (parentId) {
        groups.value = replaceNode(groups.value, parentId, node => ({
          ...node,
          children: node.children.filter(child => child.id !== tempId),
        }))
      }
      else {
        groups.value = groups.value.filter(node => node.id !== tempId)
      }
      throw err
    }
  }

  const updateGroup = async (projectId: string, groupId: string, payload: UpdateGroupPayload) => {
    const previous = groups.value
    const target = findNode(groups.value, groupId)
    if (!target)
      return

    groups.value = replaceNode(groups.value, groupId, node => ({ ...node, ...payload }))

    try {
      const { data } = await groupsApi.updateGroup(projectId, groupId, payload)
      groups.value = replaceNode(groups.value, groupId, node => ({ ...node, ...data }))
      return data
    }
    catch (err) {
      groups.value = previous
      throw err
    }
  }

  const deleteGroup = async (projectId: string, groupId: string) => {
    const previous = groups.value
    const target = findNode(groups.value, groupId)
    if (!target)
      return

    groups.value = removeNode(groups.value, groupId)

    try {
      await groupsApi.deleteGroup(projectId, groupId)
    }
    catch (err) {
      groups.value = previous
      throw err
    }
  }

  const reorderGroups = async (projectId: string, orderedIds: string[]) => {
    const previous = groups.value
    const firstId = orderedIds[0]
    const isRootLevel = groups.value.some(node => node.id === firstId)

    if (isRootLevel) {
      groups.value = orderedIds
        .map((id, i) => {
          const node = groups.value.find(n => n.id === id)
          return node ? { ...node, order: i } : null
        })
        .filter((n): n is BoardGroupNode => n !== null)
    }
    else {
      const parent = groups.value.find(epic => epic.children.some(child => child.id === firstId))
      if (parent) {
        groups.value = replaceNode(groups.value, parent.id, node => ({
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
      groups.value = previous
      throw err
    }
  }

  const toggleEpicDone = async (projectId: string, epic: BoardGroup) => {
    const nextStatus: 'open' | 'done' = epic.status === 'done' ? 'open' : 'done'
    return updateGroup(projectId, epic.id, { status: nextStatus })
  }

  return {
    groups,
    currentProjectId,
    loading,
    error,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    reorderGroups,
    toggleEpicDone,
  }
})
