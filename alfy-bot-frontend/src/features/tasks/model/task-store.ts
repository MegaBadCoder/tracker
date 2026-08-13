import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type { Task, ChecklistItem, TaskPatch } from './types'
import { toDate } from '../lib/dateTime'

function serializeDate(value: unknown): string | undefined {
  const date = toDate(value)
  if (date) return date.toISOString()
  if (typeof value === 'string') return value
  return undefined
}

function serializeTaskDates<T extends Record<string, unknown>>(data: T): T {
  return {
    ...data,
    ...(data.dueDate !== undefined && {
      dueDate: data.dueDate === null ? null : serializeDate(data.dueDate),
    }),
    ...(data.deadline !== undefined && { deadline: serializeDate(data.deadline) }),
  }
}

function parseTask(raw: Record<string, unknown>): Task {
  const config = raw.pomodoroConfig as Record<string, unknown> | null
  const recurrence = (raw.recurrence as Task['recurrence']) ?? null
  return {
    ...raw,
    dueDate: raw.dueDate ? new Date(raw.dueDate as string) : undefined,
    recurrenceAnchorDate: raw.recurrenceAnchorDate
      ? new Date(raw.recurrenceAnchorDate as string)
      : null,
    deadline: raw.deadline ? new Date(raw.deadline as string) : undefined,
    isPomodoroTask: !!config,
    pomodoroCount: config?.pomodoroCount as number | undefined,
    pomodoroDuration: config?.pomodoroDuration as number | undefined,
    shortBreak: config?.shortBreak as number | undefined,
    longBreak: config?.longBreak as number | undefined,
    longBreakInterval: config?.longBreakInterval as number | undefined,
    pomodoroCompleted: (config?.pomodoroCompleted as number) ?? 0,
    recurrence,
    recurringParentId: (raw.recurringParentId as string) ?? null,
    recurringCompletedCount: (raw.recurringCompletedCount as number) ?? 0,
    isAutoCreated: (raw.isAutoCreated as boolean) ?? false,
    isOverdue: (raw.isOverdue as boolean) ?? false,
    onMissed: (raw.onMissed as 'shift' | 'freeze') ?? 'shift',
  } as Task
}

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Apply a backend UpdateTaskResponse — { task, nextInstance?, deletedInstanceId? } —
   * to the store. Shared by every endpoint that returns that shape.
   */
  const applyUpdateResponse = (response: Record<string, unknown>, taskId: string): Task => {
    const taskData = response.task ? response.task as Record<string, unknown> : response
    const updatedTask = parseTask(taskData)

    const index = tasks.value.findIndex(t => t.id === taskId)
    if (index !== -1) {
      const existing = tasks.value[index]!
      tasks.value[index] = { ...existing, ...updatedTask, checklist: existing.checklist }
    }

    // Handle recurring: add or refresh next instance in store.
    // On complete -> brand-new instance; on uncomplete -> promoted existing instance with updated fields.
    if (response.nextInstance) {
      const nextInstance = parseTask(response.nextInstance as Record<string, unknown>)
      const existingIndex = tasks.value.findIndex(t => t.id === nextInstance.id)
      if (existingIndex === -1) {
        tasks.value.unshift(nextInstance)
      } else {
        const existing = tasks.value[existingIndex]!
        tasks.value[existingIndex] = { ...existing, ...nextInstance, checklist: existing.checklist }
      }
    }

    // Handle recurring: remove deleted instance from store
    if (response.deletedInstanceId) {
      const deletedId = response.deletedInstanceId as string
      tasks.value = tasks.value.filter(t => t.id !== deletedId)
    }

    return updatedTask
  }

  const fetchTasks = async () => {
    loading.value = true
    error.value = null

    try {
      const { data } = await api.get<Record<string, unknown>[]>('/tasks')
      tasks.value = data.map(parseTask)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка загрузки задач'
      console.error('Ошибка загрузки задач:', err)
    } finally {
      loading.value = false
    }
  }

  const createTask = async (taskData: Omit<Task, 'id' | 'pomodoroCompleted'>) => {
    const tempId = `temp-${Date.now()}`
    const tempTask: Task = {
      ...taskData,
      id: tempId,
      completed: false,
      pomodoroCompleted: 0,
      dueDate: toDate(taskData.dueDate),
      deadline: toDate(taskData.deadline),
    }

    tasks.value.unshift(tempTask)

    try {
      const { data } = await api.post('/tasks', serializeTaskDates(taskData as unknown as Record<string, unknown>))
      const created = parseTask(data)

      const index = tasks.value.findIndex(t => t.id === tempId)
      if (index !== -1) {
        tasks.value[index] = created
      }
      return created
    } catch (err) {
      tasks.value = tasks.value.filter(t => t.id !== tempId)
      error.value = err instanceof Error ? err.message : 'Ошибка создания задачи'
      console.error('Ошибка создания задачи:', err)
      throw err
    }
  }

  const updateTask = async (taskId: string, updates: TaskPatch, setLoading = true) => {
    if (taskId.includes('__virtual__')) {
      console.warn('Attempted to update a virtual task instance, ignoring:', taskId)
      return
    }

    const localTask = tasks.value.find(t => t.id === taskId)
    if (localTask?.isOverdue) {
      console.warn('Attempt to update overdue task ignored:', taskId)
      return
    }

    if (setLoading) {
      loading.value = true
      error.value = null
    }

    try {
      const {
        checklist, checklistProgress,
        isPomodoroTask, pomodoroCount, pomodoroDuration,
        shortBreak, longBreak, longBreakInterval, pomodoroCompleted,
        recurringCompletedCount, isAutoCreated, recurringParentId,
        recurrenceAnchorDate,
        ...rest
      } = updates as Record<string, unknown>
      const { data } = await api.patch(`/tasks/${taskId}`, serializeTaskDates(rest))

      return applyUpdateResponse(data as Record<string, unknown>, taskId)
    } catch (err) {
      if (setLoading) {
        error.value = err instanceof Error ? err.message : 'Ошибка обновления задачи'
      }
      console.error('Ошибка обновления задачи:', err)
      throw err
    } finally {
      if (setLoading) {
        loading.value = false
      }
    }
  }

  const toggleTask = async (taskId: string) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    const previousCompleted = task.completed
    task.completed = !task.completed

    try {
      await updateTask(taskId, { completed: task.completed }, false)
    } catch (err) {
      task.completed = previousCompleted
      throw err
    }
  }

  const deleteTask = async (taskId: string) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    const snapshot = tasks.value.slice()
    tasks.value = tasks.value.filter(t => t.id !== taskId)

    try {
      const { data } = await api.delete<{ deletedIds?: string[]; updated?: Record<string, unknown>[] }>(
        `/tasks/${taskId}`,
      )
      const deletedIds = new Set(data?.deletedIds?.length ? data.deletedIds : [taskId])
      tasks.value = snapshot
        .filter(t => !deletedIds.has(t.id))
        .map(t => {
          const raw = data?.updated?.find(u => u.id === t.id)
          return raw ? { ...t, ...parseTask(raw) } : t
        })
    } catch (err) {
      tasks.value = snapshot
      console.error('Ошибка удаления задачи:', err)
      throw err
    }
  }

  const incrementPomodoro = async (taskId: string, increment: number) => {
    // The task may not be in the store yet (the timer restores its session before
    // fetchTasks resolves) — the increment must still reach the backend, so only
    // the optimistic bump is conditional.
    const task = tasks.value.find(t => t.id === taskId)
    const previousPomodoroCompleted = task?.pomodoroCompleted ?? 0

    if (task) {
      task.pomodoroCompleted = Math.round((previousPomodoroCompleted + increment) * 100) / 100
    }

    try {
      const { data } = await api.patch(`/tasks/${taskId}/pomodoro`, { increment })
      return applyUpdateResponse(data as Record<string, unknown>, taskId)
    } catch (err) {
      if (task) task.pomodoroCompleted = previousPomodoroCompleted
      console.error('Ошибка сохранения помодоро:', err)
    }
  }

  const updatePomodoroConfig = async (taskId: string, config: Record<string, unknown> | null) => {
    try {
      const { data } = config === null
        ? await api.delete(`/tasks/${taskId}/pomodoro-config`)
        : await api.put(`/tasks/${taskId}/pomodoro-config`, config)
      const updated = parseTask(data)
      const index = tasks.value.findIndex(t => t.id === taskId)
      if (index !== -1) {
        const existing = tasks.value[index]
        if (existing) {
          tasks.value[index] = {
            ...existing,
            isPomodoroTask: updated.isPomodoroTask,
            pomodoroCount: updated.pomodoroCount,
            pomodoroDuration: updated.pomodoroDuration,
            shortBreak: updated.shortBreak,
            longBreak: updated.longBreak,
            longBreakInterval: updated.longBreakInterval,
            pomodoroCompleted: updated.pomodoroCompleted,
          }
        }
      }
    } catch (err) {
      console.error('Ошибка обновления помодоро:', err)
      throw err
    }
  }

  const updateChecklist = async (taskId: string, items: ChecklistItem[]) => {
    try {
      const { data } = await api.put(`/tasks/${taskId}/checklist`, { items })
      const updated = parseTask(data)
      const index = tasks.value.findIndex(t => t.id === taskId)
      if (index !== -1) {
        const existing = tasks.value[index]
        if (existing) {
          tasks.value[index] = { ...existing, checklist: updated.checklist }
        }
      }
    } catch (err) {
      console.error('Ошибка обновления чеклиста:', err)
      throw err
    }
  }

  const moveTask = async (taskId: string, projectId: string | null, payload: { columnId?: string | null; order?: number }) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    const previous = { projectId: task.projectId, columnId: task.columnId, order: task.order }

    task.projectId = projectId
    if (payload.columnId !== undefined) task.columnId = payload.columnId
    if (payload.order !== undefined) task.order = payload.order

    try {
      if (projectId === null) {
        const body: { order?: number } = {}
        if (payload.order !== undefined) body.order = payload.order
        await api.patch(`/tasks/${taskId}/move-to-inbox`, body)
      } else {
        await api.patch(`/projects/${projectId}/tasks/${taskId}/move`, payload)
      }
    } catch (err) {
      task.projectId = previous.projectId
      task.columnId = previous.columnId
      task.order = previous.order
      throw err
    }
  }

  const reorderInboxTasks = async (orderedIds: string[]) => {
    const previousOrders = new Map(
      orderedIds.map(id => {
        const t = tasks.value.find(task => task.id === id)
        return [id, t?.order] as [string, number | undefined]
      }),
    )

    orderedIds.forEach((id, i) => {
      const t = tasks.value.find(task => task.id === id)
      if (t) t.order = i
    })

    try {
      await api.patch('/tasks/reorder', { orderedIds })
    } catch (err) {
      orderedIds.forEach(id => {
        const t = tasks.value.find(task => task.id === id)
        if (t) t.order = previousOrders.get(id)
      })
      throw err
    }
  }

  const reorderTasks = async (projectId: string, orderedIds: string[], columnId?: string) => {
    const previousOrders = new Map(
      orderedIds.map(id => {
        const t = tasks.value.find(task => task.id === id)
        return [id, t?.order] as [string, number | undefined]
      }),
    )

    orderedIds.forEach((id, i) => {
      const t = tasks.value.find(task => task.id === id)
      if (t) t.order = i
    })

    try {
      await api.patch(`/projects/${projectId}/tasks/reorder`, { orderedIds, columnId })
    } catch (err) {
      orderedIds.forEach(id => {
        const t = tasks.value.find(task => task.id === id)
        if (t) t.order = previousOrders.get(id)
      })
      throw err
    }
  }

  const materializeOccurrence = async (virtualTaskId: string) => {
    const sep = '__virtual__'
    const idx = virtualTaskId.indexOf(sep)
    if (idx === -1) {
      throw new Error('Not a virtual occurrence id')
    }
    const sourceId = virtualTaskId.slice(0, idx)
    const timestamp = Number(virtualTaskId.slice(idx + sep.length))
    if (!sourceId || !Number.isFinite(timestamp)) {
      throw new Error('Invalid virtual occurrence id')
    }

    const { data } = await api.post(`/tasks/${sourceId}/materialize`, {
      occurrenceDate: new Date(timestamp).toISOString(),
    })
    const created = parseTask(data as Record<string, unknown>)
    const existingIndex = tasks.value.findIndex(t => t.id === created.id)
    if (existingIndex === -1) {
      tasks.value.unshift(created)
    } else {
      tasks.value[existingIndex] = created
    }
    return created
  }

  const completedTasks = computed(() => tasks.value.filter(t => t.completed))
  const pendingTasks = computed(() => tasks.value.filter(t => !t.completed))
  const pomodoroTasks = computed(() => tasks.value.filter(t => t.isPomodoroTask))
  const highPriorityTasks = computed(() => tasks.value.filter(t => t.priority === 'high'))

  return {
    tasks,
    loading,
    error,
    completedTasks,
    pendingTasks,
    pomodoroTasks,
    highPriorityTasks,
    fetchTasks,
    createTask,
    updateTask,
    toggleTask,
    deleteTask,
    moveTask,
    reorderInboxTasks,
    reorderTasks,
    incrementPomodoro,
    updateChecklist,
    updatePomodoroConfig,
    materializeOccurrence,
  }
})
