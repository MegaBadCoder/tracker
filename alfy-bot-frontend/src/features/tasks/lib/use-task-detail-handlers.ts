import { ref, type Ref, isRef, toRef } from 'vue'
import type { Task, ChecklistItem } from '../model/types'

interface TaskStore {
  tasks: Task[] | Ref<Task[]>
  updateTask: (id: string, updates: Partial<Task>, setLoading?: boolean) => Promise<unknown>
  deleteTask: (id: string) => Promise<void>
  updateChecklist: (id: string, items: ChecklistItem[]) => Promise<void>
  updatePomodoroConfig: (id: string, config: Record<string, unknown> | null) => Promise<void>
}

type ConfirmFn = (opts: {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
}) => Promise<boolean>

export function useTaskDetailHandlers(store: TaskStore, confirm: ConfirmFn) {
  const selectedTask = ref<Task | null>(null)
  const isDetailOpen = ref(false)
  const tasks = isRef(store.tasks) ? store.tasks : toRef(store, 'tasks') as Ref<Task[]>

  function handleOpenTask(task: Task) {
    selectedTask.value = task
    isDetailOpen.value = true
  }

  async function handleUpdateTask(updatedTask: Task) {
    const index = tasks.value.findIndex(t => t.id === updatedTask.id)
    const previous: Task | null = index !== -1 ? { ...tasks.value[index] } as Task : null

    if (index !== -1) tasks.value[index] = updatedTask
    selectedTask.value = updatedTask

    try {
      await store.updateTask(updatedTask.id, updatedTask, false)
    } catch {
      if (previous && index !== -1) {
        tasks.value[index] = previous
        selectedTask.value = previous
      }
    }
  }

  async function handleUpdateChecklist(taskId: string, items: ChecklistItem[]) {
    const index = tasks.value.findIndex(t => t.id === taskId)
    const previousChecklist = index !== -1 ? tasks.value[index]?.checklist : undefined

    if (index !== -1) {
      const task = tasks.value[index]
      tasks.value[index] = { ...task, checklist: { items } } as Task
    }
    if (selectedTask.value?.id === taskId) {
      selectedTask.value = { ...selectedTask.value, checklist: { items } } as Task
    }

    try {
      await store.updateChecklist(taskId, items)
    } catch {
      if (index !== -1) {
        const task = tasks.value[index]
        tasks.value[index] = { ...task, checklist: previousChecklist } as Task
      }
      if (selectedTask.value?.id === taskId) {
        selectedTask.value = { ...selectedTask.value, checklist: previousChecklist } as Task
      }
    }
  }

  async function handleUpdatePomodoroConfig(taskId: string, config: Record<string, unknown>) {
    const index = tasks.value.findIndex(t => t.id === taskId)
    const previous: Task | null = index !== -1 ? { ...tasks.value[index] } as Task : null

    if (index !== -1) {
      tasks.value[index] = { ...tasks.value[index], ...config } as Task
    }
    if (selectedTask.value?.id === taskId) {
      selectedTask.value = { ...selectedTask.value, ...config } as Task
    }

    try {
      await store.updatePomodoroConfig(taskId, config)
    } catch {
      if (previous && index !== -1) {
        tasks.value[index] = previous
        selectedTask.value = previous
      }
    }
  }

  async function handleDeleteFromDialog(taskId: string) {
    isDetailOpen.value = false
    selectedTask.value = null

    const confirmed = await confirm({
      title: 'Удалить задачу?',
      message: 'Это действие нельзя отменить.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
    })
    if (!confirmed) return

    await store.deleteTask(taskId)
  }

  return {
    selectedTask,
    isDetailOpen,
    handleOpenTask,
    handleUpdateTask,
    handleUpdateChecklist,
    handleUpdatePomodoroConfig,
    handleDeleteFromDialog,
  }
}
