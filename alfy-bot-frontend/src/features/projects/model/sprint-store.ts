import type { CreateSprintPayload, Sprint, StartSprintPayload, UpdateSprintPayload } from './types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import * as groupsApi from '../api/groups-api'
import * as sprintsApi from '../api/sprints-api'
import { useGroupStore } from './group-store'

function byOrder(a: Sprint, b: Sprint): number {
  return a.order - b.order
}

/**
 * Единственный кэш спринтов по проектам (`lists[projectId]`). Копий списка
 * в компонентах быть не должно. Изменения оптимистичны и откатываются при
 * ошибке API; локальные эффекты на задачи применяются только после успеха.
 */
export const useSprintStore = defineStore('sprints', () => {
  const lists = ref<Record<string, Sprint[]>>({})
  const loadingProjects = ref<Set<string>>(new Set())
  const error = ref<string | null>(null)

  async function refreshAssignments(projectId: string): Promise<void> {
    const groupStore = useGroupStore()
    const taskStore = useTaskStore()
    await Promise.all([groupStore.fetchGroups(projectId), taskStore.fetchTasks()])
    const failure = groupStore.error || taskStore.error
    if (failure) {
      error.value = `Изменения сохранены, но не удалось обновить данные: ${failure}`
      throw new Error(error.value)
    }
    error.value = null
  }

  /** Сохраняет спринт истории и обновляет задачи и дерево после успеха API. */
  async function setStorySprint(projectId: string, storyId: string, sprintId: string | null): Promise<number> {
    const { data } = await groupsApi.setGroupSprint(projectId, storyId, sprintId)
    await refreshAssignments(projectId)
    return data.updated
  }

  /** Все спринты проекта, включая завершённые, в порядке `order`. Для незагруженного проекта — `[]`. */
  function sprintsOf(projectId: string): Sprint[] {
    return lists.value[projectId] ?? []
  }

  /** Единственный активный спринт проекта или `null`. */
  function activeSprintOf(projectId: string): Sprint | null {
    return sprintsOf(projectId).find(s => s.status === 'active') ?? null
  }

  /** Запланированные спринты проекта в порядке `order`. */
  function plannedSprintsOf(projectId: string): Sprint[] {
    return sprintsOf(projectId).filter(s => s.status === 'planned').sort(byOrder)
  }

  function isLoading(projectId: string): boolean {
    return loadingProjects.value.has(projectId)
  }

  function patchSprint(projectId: string, id: string, patch: Partial<Sprint>) {
    lists.value[projectId] = sprintsOf(projectId).map(s => (s.id === id ? { ...s, ...patch } : s))
  }

  const fetchSprints = async (projectId: string) => {
    loadingProjects.value.add(projectId)
    error.value = null

    try {
      const { data } = await sprintsApi.fetchSprints(projectId)
      lists.value[projectId] = data
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка загрузки спринтов'
    }
    finally {
      loadingProjects.value.delete(projectId)
    }
  }

  /** Загружает спринты проекта, только если они ещё не загружены и не грузятся. */
  async function ensureSprints(projectId: string): Promise<void> {
    if (projectId in lists.value || isLoading(projectId))
      return
    await fetchSprints(projectId)
  }

  const createSprint = async (projectId: string, payload: CreateSprintPayload) => {
    const tempId = `temp-${Date.now()}`
    const now = new Date().toISOString()
    const current = sprintsOf(projectId)
    const tempSprint: Sprint = {
      id: tempId,
      userId: 0,
      projectId,
      name: payload.name ?? `Спринт ${current.length + 1}`,
      goal: payload.goal ?? null,
      startDate: null,
      endDate: null,
      status: 'planned',
      completedAt: null,
      order: current.length,
      createdAt: now,
      updatedAt: now,
    }

    lists.value[projectId] = [...current, tempSprint]

    try {
      const { data } = await sprintsApi.createSprint(projectId, payload)
      lists.value[projectId] = sprintsOf(projectId).map(s => (s.id === tempId ? data : s))
      return data
    }
    catch (err) {
      lists.value[projectId] = sprintsOf(projectId).filter(s => s.id !== tempId)
      throw err
    }
  }

  const updateSprint = async (projectId: string, id: string, payload: UpdateSprintPayload) => {
    const previous = sprintsOf(projectId)
    if (!previous.some(s => s.id === id))
      return

    patchSprint(projectId, id, payload)

    try {
      const { data } = await sprintsApi.updateSprint(projectId, id, payload)
      patchSprint(projectId, id, data)
      return data
    }
    catch (err) {
      lists.value[projectId] = previous
      throw err
    }
  }

  /**
   * Удаляет спринт. После успеха API задачи спринта локально уходят в
   * бэклог (`sprintId = null`) — сами задачи не удаляются.
   */
  const deleteSprint = async (projectId: string, id: string) => {
    const previous = sprintsOf(projectId)
    if (!previous.some(s => s.id === id))
      return

    lists.value[projectId] = previous.filter(s => s.id !== id)

    try {
      await sprintsApi.deleteSprint(projectId, id)
    }
    catch (err) {
      lists.value[projectId] = previous
      throw err
    }

    const taskStore = useTaskStore()
    taskStore.tasks = taskStore.tasks.map(t => (t.sprintId === id ? { ...t, sprintId: null } : t))
    await refreshAssignments(projectId)
  }

  /** Запускает запланированный спринт: `active` с датами старта и конца. */
  const startSprint = async (projectId: string, id: string, payload: StartSprintPayload) => {
    const previous = sprintsOf(projectId)
    if (!previous.some(s => s.id === id))
      return

    patchSprint(projectId, id, {
      status: 'active',
      startDate: payload.startDate,
      endDate: payload.endDate,
      ...(payload.goal !== undefined ? { goal: payload.goal } : {}),
    })

    try {
      const { data } = await sprintsApi.startSprint(projectId, id, payload)
      patchSprint(projectId, id, data)
      return data
    }
    catch (err) {
      lists.value[projectId] = previous
      throw err
    }
  }

  /**
   * Завершает спринт. `moveTo` — `'backlog'` или id спринта, куда уходят
   * незавершённые задачи; после успеха API им локально выставляется
   * `sprintId` (`'backlog'` → `null`), выполненные задачи остаются в спринте.
   */
  const completeSprint = async (projectId: string, id: string, moveTo: 'backlog' | string) => {
    const previous = sprintsOf(projectId)
    if (!previous.some(s => s.id === id))
      return

    patchSprint(projectId, id, { status: 'closed' })

    let data: Sprint
    try {
      ({ data } = await sprintsApi.completeSprint(projectId, id, { moveTo }))
    }
    catch (err) {
      lists.value[projectId] = previous
      throw err
    }

    patchSprint(projectId, id, data)
    const targetId = moveTo === 'backlog' ? null : moveTo
    const taskStore = useTaskStore()
    taskStore.tasks = taskStore.tasks.map(t =>
      (t.sprintId === id && !t.completed) ? { ...t, sprintId: targetId } : t,
    )
    await refreshAssignments(projectId)
    return data
  }

  return {
    setStorySprint,
    lists,
    error,
    sprintsOf,
    activeSprintOf,
    plannedSprintsOf,
    isLoading,
    fetchSprints,
    ensureSprints,
    createSprint,
    updateSprint,
    deleteSprint,
    startSprint,
    completeSprint,
  }
})
