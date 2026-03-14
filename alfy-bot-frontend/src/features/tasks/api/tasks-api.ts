import { ref, computed } from 'vue'
import { api } from '@/api/client'
import type { Task } from '../model/types'

function serializeDate(value: unknown): string | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null && 'year' in value && 'month' in value && 'day' in value) {
    const v = value as { year: number; month: number; day: number; hour?: number; minute?: number }
    const d = new Date(v.year, v.month - 1, v.day, v.hour ?? 0, v.minute ?? 0)
    return d.toISOString()
  }
  if (typeof value === 'string') return value
  return undefined
}

function parseDateValue(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'year' in value && 'month' in value && 'day' in value) {
    const v = value as { year: number; month: number; day: number; hour?: number; minute?: number }
    return new Date(v.year, v.month - 1, v.day, v.hour ?? 0, v.minute ?? 0)
  }
  if (typeof value === 'string') return new Date(value)
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
  } as Task
}

export function useTasks() {
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
      dueDate: parseDateValue(taskData.dueDate),
      deadline: parseDateValue(taskData.deadline),
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
      const { data } = await api.patch(`/tasks/${taskId}`, serializeTaskDates(updates as unknown as Record<string, unknown>))
      const updatedTask = parseTask(data)
      const index = tasks.value.findIndex(t => t.id === taskId)
      if (index !== -1) {
        tasks.value[index] = updatedTask
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

    task.pomodoroCompleted = (task.pomodoroCompleted || 0) + increment

    try {
      await api.patch(`/tasks/${taskId}/pomodoro`, { increment })
    } catch (err) {
      task.pomodoroCompleted = (task.pomodoroCompleted || 0) - increment
      console.error('Ошибка сохранения помодоро:', err)
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
    incrementPomodoro,
  }
}
