import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type { Task, ChecklistItem } from './types'
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
    ...(data.dueDate !== undefined && { dueDate: serializeDate(data.dueDate) }),
    ...(data.deadline !== undefined && { deadline: serializeDate(data.deadline) }),
  }
}

function parseTask(raw: Record<string, unknown>): Task {
  const config = raw.pomodoroConfig as Record<string, unknown> | null
  const recurrence = (raw.recurrence as Task['recurrence']) ?? null
  return {
    ...raw,
    dueDate: raw.dueDate ? new Date(raw.dueDate as string) : undefined,
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
  } as Task
}

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

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

  const updateTask = async (taskId: string, updates: Partial<Task>, setLoading = true) => {
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
        ...rest
      } = updates as Record<string, unknown>
      const { data } = await api.patch(`/tasks/${taskId}`, serializeTaskDates(rest))

      // Backend returns UpdateTaskResponse: { task, nextInstance?, deletedInstanceId? }
      const response = data as Record<string, unknown>
      const taskData = response.task ? response.task as Record<string, unknown> : response
      const updatedTask = parseTask(taskData)

      const index = tasks.value.findIndex(t => t.id === taskId)
      if (index !== -1) {
        tasks.value[index] = { ...updatedTask, checklist: tasks.value[index]?.checklist }
      }

      // Handle recurring: add new instance to store
      if (response.nextInstance) {
        const nextInstance = parseTask(response.nextInstance as Record<string, unknown>)
        tasks.value.unshift(nextInstance)
      }

      // Handle recurring: remove deleted instance from store
      if (response.deletedInstanceId) {
        const deletedId = response.deletedInstanceId as string
        tasks.value = tasks.value.filter(t => t.id !== deletedId)
      }

      return updatedTask
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

    const taskToRestore = { ...task }
    tasks.value = tasks.value.filter(t => t.id !== taskId)

    try {
      await api.delete(`/tasks/${taskId}`)
    } catch (err) {
      tasks.value.push(taskToRestore)
      console.error('Ошибка удаления задачи:', err)
      throw err
    }
  }

  const incrementPomodoro = async (taskId: string, increment: number) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task || !task.isPomodoroTask) return

    task.pomodoroCompleted = Math.round(((task.pomodoroCompleted || 0) + increment) * 100) / 100

    try {
      await api.patch(`/tasks/${taskId}/pomodoro`, { increment })
    } catch (err) {
      task.pomodoroCompleted = Math.round(((task.pomodoroCompleted || 0) - increment) * 100) / 100
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

  const moveTask = async (taskId: string, projectId: string, payload: { columnId?: string | null; order?: number }) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    const previous = { projectId: task.projectId, columnId: task.columnId, order: task.order }

    task.projectId = projectId
    if (payload.columnId !== undefined) task.columnId = payload.columnId
    if (payload.order !== undefined) task.order = payload.order

    try {
      await api.patch(`/projects/${projectId}/tasks/${taskId}/move`, payload)
    } catch (err) {
      task.projectId = previous.projectId
      task.columnId = previous.columnId
      task.order = previous.order
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
    reorderTasks,
    incrementPomodoro,
    updateChecklist,
    updatePomodoroConfig,
  }
})
