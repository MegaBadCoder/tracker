import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import * as columnsApi from '../api/columns-api'
import type { ProjectColumn } from './types'

export const useColumnStore = defineStore('columns', () => {
  const columns = ref<ProjectColumn[]>([])
  const currentProjectId = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const columnMap = computed(() =>
    new Map(columns.value.map(c => [c.id, c])),
  )

  const fetchColumns = async (projectId: string) => {
    loading.value = true
    error.value = null
    currentProjectId.value = projectId

    try {
      const { data } = await columnsApi.fetchColumns(projectId)
      columns.value = data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка загрузки колонок'
    } finally {
      loading.value = false
    }
  }

  const createColumn = async (projectId: string, payload: { title: string; color?: string | null }) => {
    const tempId = `temp-${Date.now()}`
    const tempColumn: ProjectColumn = {
      id: tempId,
      projectId,
      title: payload.title,
      order: columns.value.length,
      color: payload.color ?? null,
    }

    columns.value.push(tempColumn)

    try {
      const { data } = await columnsApi.createColumn(projectId, payload)
      const index = columns.value.findIndex(c => c.id === tempId)
      if (index !== -1) {
        columns.value[index] = data
      }
      return data
    } catch (err) {
      columns.value = columns.value.filter(c => c.id !== tempId)
      throw err
    }
  }

  const updateColumn = async (projectId: string, columnId: string, payload: { title?: string; color?: string | null }) => {
    const index = columns.value.findIndex(c => c.id === columnId)
    if (index === -1) return

    const current = columns.value[index]
    if (!current) return
    const previous = { ...current }
    columns.value[index] = { ...previous, ...payload } as ProjectColumn

    try {
      const { data } = await columnsApi.updateColumn(projectId, columnId, payload)
      columns.value[index] = data
      return data
    } catch (err) {
      columns.value[index] = previous
      throw err
    }
  }

  const deleteColumn = async (projectId: string, columnId: string) => {
    const index = columns.value.findIndex(c => c.id === columnId)
    if (index === -1) return

    const removed = columns.value.splice(index, 1)[0]
    if (!removed) return

    try {
      await columnsApi.deleteColumn(projectId, columnId)
    } catch (err) {
      columns.value.splice(index, 0, removed)
      throw err
    }
  }

  const reorderColumns = async (projectId: string, orderedIds: string[]) => {
    const previous = [...columns.value]

    columns.value = orderedIds
      .map((id, i) => {
        const col = columns.value.find(c => c.id === id)
        return col ? { ...col, order: i } : null
      })
      .filter((c): c is ProjectColumn => c !== null)

    try {
      await columnsApi.reorderColumns(projectId, orderedIds)
    } catch (err) {
      columns.value = previous
      throw err
    }
  }

  return {
    columns,
    currentProjectId,
    loading,
    error,
    columnMap,
    fetchColumns,
    createColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
  }
})
