import type { TaskDependencyEdge } from './task-dependencies'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchTaskDependencies, setTaskDependencies } from '../api/task-dependencies-api'

/** Общий граф зависимостей текущего пользователя с защитой снимков от параллельных изменений. */
export const useTaskDependencyStore = defineStore('task-dependencies', () => {
  const edges = ref<TaskDependencyEdge[]>([])
  const revision = ref(0)
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)
  const writes = new Map<string, Promise<void>>()
  let activeWrites = 0
  let loadRequest = 0

  /** Применяет полный снимок только при неизменной ревизии и отсутствии незавершённых записей. */
  function applySnapshot(snapshot: TaskDependencyEdge[], snapshotRevision: number): boolean {
    if (snapshotRevision !== revision.value || activeWrites > 0)
      return false
    edges.value = snapshot.map(edge => ({ ...edge }))
    loaded.value = true
    error.value = null
    return true
  }

  /** Обновляет полный граф, повторяя устаревший запрос после записей; ошибка API отклоняет промис. */
  async function fetchGraph(): Promise<void> {
    const request = ++loadRequest
    loading.value = true
    error.value = null
    try {
      while (true) {
        await Promise.allSettled([...writes.values()])
        const snapshotRevision = revision.value
        const { data } = await fetchTaskDependencies()
        if (request !== loadRequest || applySnapshot(data, snapshotRevision))
          return
      }
    }
    catch (cause) {
      if (request === loadRequest)
        error.value = cause instanceof Error ? cause.message : 'Не удалось загрузить зависимости'
      throw cause
    }
    finally {
      if (request === loadRequest)
        loading.value = false
    }
  }

  async function persist(taskId: string, dependencyIds: string[], previous: Promise<void> | undefined): Promise<void> {
    try {
      if (previous)
        await previous.catch(() => undefined)
      const { data } = await setTaskDependencies(taskId, dependencyIds)
      edges.value = [
        ...edges.value.filter(edge => edge.taskId !== taskId),
        ...data.dependencyIds.map(dependencyId => ({ taskId: data.taskId, dependencyId })),
      ]
    }
    finally {
      activeWrites--
      revision.value++
    }
  }

  /** Сохраняет канонические связи одной задачи; её записи выполняются по очереди, ошибки не меняют граф. */
  async function replace(taskId: string, dependencyIds: string[]): Promise<void> {
    activeWrites++
    revision.value++
    const operation = persist(taskId, [...dependencyIds], writes.get(taskId))
    writes.set(taskId, operation)
    try {
      await operation
    }
    finally {
      if (writes.get(taskId) === operation)
        writes.delete(taskId)
    }
  }

  return { edges, revision, loading, loaded, error, applySnapshot, fetchGraph, replace }
})
