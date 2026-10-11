import type { CreateReleasePayload, Release, UpdateReleasePayload } from './types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import * as groupsApi from '../api/groups-api'
import * as releasesApi from '../api/releases-api'
import { useGroupStore } from './group-store'

function byOrder(a: Release, b: Release): number {
  return a.order - b.order
}

function byReleasedAtDesc(a: Release, b: Release): number {
  return Date.parse(b.releasedAt!) - Date.parse(a.releasedAt!)
}

/**
 * Единственный кэш релизов по проектам (`lists[projectId]`). Копий списка
 * в компонентах быть не должно. Изменения оптимистичны и откатываются при
 * ошибке API; локальные эффекты на задачи применяются только после успеха.
 */
export const useReleaseStore = defineStore('releases', () => {
  const lists = ref<Record<string, Release[]>>({})
  const loadingProjects = ref<Set<string>>(new Set())
  const error = ref<string | null>(null)

  async function refreshAssignments(projectId: string, includeTasks: boolean): Promise<void> {
    const groupStore = useGroupStore()
    const taskStore = useTaskStore()
    const reads = [groupStore.fetchGroups(projectId)]
    if (includeTasks)
      reads.push(taskStore.fetchTasks())
    await Promise.all(reads)
    const failure = groupStore.error || (includeTasks ? taskStore.error : null)
    if (failure) {
      error.value = `Изменения сохранены, но не удалось обновить данные: ${failure}`
      throw new Error(error.value)
    }
    error.value = null
  }

  /** Все релизы проекта, включая выпущенные, в порядке `order`. Для незагруженного проекта — `[]`. */
  function releasesOf(projectId: string): Release[] {
    return lists.value[projectId] ?? []
  }

  /** Запланированные релизы проекта в порядке `order`. */
  function plannedReleasesOf(projectId: string): Release[] {
    return releasesOf(projectId).filter(r => r.status === 'planned').sort(byOrder)
  }

  /** Выпущенные релизы проекта, самые свежие (по `releasedAt`) первыми. */
  function releasedReleasesOf(projectId: string): Release[] {
    return releasesOf(projectId).filter(r => r.status === 'released').sort(byReleasedAtDesc)
  }

  function isLoading(projectId: string): boolean {
    return loadingProjects.value.has(projectId)
  }

  function patchRelease(projectId: string, id: string, patch: Partial<Release>) {
    lists.value[projectId] = releasesOf(projectId).map(r => (r.id === id ? { ...r, ...patch } : r))
  }

  const fetchReleases = async (projectId: string) => {
    loadingProjects.value.add(projectId)
    error.value = null

    try {
      const { data } = await releasesApi.fetchReleases(projectId)
      lists.value[projectId] = data
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка загрузки релизов'
    }
    finally {
      loadingProjects.value.delete(projectId)
    }
  }

  /** Загружает релизы проекта, только если они ещё не загружены и не грузятся. */
  async function ensureReleases(projectId: string): Promise<void> {
    if (projectId in lists.value || isLoading(projectId))
      return
    await fetchReleases(projectId)
  }

  const createRelease = async (projectId: string, payload: CreateReleasePayload) => {
    const tempId = `temp-${Date.now()}`
    const now = new Date().toISOString()
    const current = releasesOf(projectId)
    const tempRelease: Release = {
      id: tempId,
      userId: 0,
      projectId,
      name: payload.name,
      description: payload.description ?? null,
      startDate: payload.startDate ?? null,
      releaseDate: payload.releaseDate ?? null,
      status: 'planned',
      releasedAt: null,
      order: current.length,
      createdAt: now,
      updatedAt: now,
    }

    lists.value[projectId] = [...current, tempRelease]

    try {
      const { data } = await releasesApi.createRelease(projectId, payload)
      lists.value[projectId] = releasesOf(projectId).map(r => (r.id === tempId ? data : r))
      return data
    }
    catch (err) {
      lists.value[projectId] = releasesOf(projectId).filter(r => r.id !== tempId)
      throw err
    }
  }

  const updateRelease = async (projectId: string, id: string, payload: UpdateReleasePayload) => {
    const previous = releasesOf(projectId)
    if (!previous.some(r => r.id === id))
      return

    patchRelease(projectId, id, payload)

    try {
      const { data } = await releasesApi.updateRelease(projectId, id, payload)
      patchRelease(projectId, id, data)
      return data
    }
    catch (err) {
      lists.value[projectId] = previous
      throw err
    }
  }

  /**
   * Удаляет релиз. После успеха API задачи релиза локально теряют
   * `releaseId` (`null`) — сами задачи не удаляются.
   */
  const deleteRelease = async (projectId: string, id: string) => {
    const previous = releasesOf(projectId)
    if (!previous.some(r => r.id === id))
      return

    lists.value[projectId] = previous.filter(r => r.id !== id)

    try {
      await releasesApi.deleteRelease(projectId, id)
    }
    catch (err) {
      lists.value[projectId] = previous
      throw err
    }

    const taskStore = useTaskStore()
    taskStore.tasks = taskStore.tasks.map(t => (t.releaseId === id ? { ...t, releaseId: null } : t))
    await refreshAssignments(projectId, false)
  }

  /**
   * Выпускает запланированный релиз. `moveTo` — `'none'` или id релиза, куда
   * уходят незавершённые задачи; после успеха API им локально выставляется
   * `releaseId` (`'none'` → `null`), выполненные задачи остаются в выпущенном релизе.
   */
  const releaseRelease = async (projectId: string, id: string, moveTo: 'none' | string) => {
    const previous = releasesOf(projectId)
    if (!previous.some(r => r.id === id))
      return

    patchRelease(projectId, id, { status: 'released' })

    let data: Release
    try {
      ({ data } = await releasesApi.releaseRelease(projectId, id, { moveTo }))
    }
    catch (err) {
      lists.value[projectId] = previous
      throw err
    }

    patchRelease(projectId, id, data)
    const targetId = moveTo === 'none' ? null : moveTo
    const taskStore = useTaskStore()
    taskStore.tasks = taskStore.tasks.map(t =>
      (t.releaseId === id && !t.completed) ? { ...t, releaseId: targetId } : t,
    )
    await refreshAssignments(projectId, false)
    return data
  }

  /**
   * Назначает в релиз все задачи группы (эпик вместе с историями либо
   * историю). После успеха API перечитывает задачи и возвращает число
   * затронутых задач.
   */
  const assignGroup = async (projectId: string, releaseId: string, groupId: string) => {
    const { data } = await releasesApi.assignGroupToRelease(projectId, releaseId, { groupId })
    await refreshAssignments(projectId, true)
    return data.updated
  }

  /** Сохраняет плановый релиз истории и обновляет дерево и задачи после успеха API. */
  async function setStoryRelease(projectId: string, groupId: string, releaseId: string | null): Promise<number> {
    const { data } = await groupsApi.setGroupRelease(projectId, groupId, releaseId)
    await refreshAssignments(projectId, true)
    return data.updated
  }

  return {
    setStoryRelease,
    lists,
    error,
    releasesOf,
    plannedReleasesOf,
    releasedReleasesOf,
    isLoading,
    fetchReleases,
    ensureReleases,
    createRelease,
    updateRelease,
    deleteRelease,
    releaseRelease,
    assignGroup,
  }
})
