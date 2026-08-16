import { ref, type Ref, isRef, toRef } from 'vue'
import type { Task, ChecklistItem, TaskPatch } from '../model/types'
import { useRecurringReschedule, shouldPromptReschedule } from './use-recurring-reschedule'

interface TaskStore {
  tasks: Task[] | Ref<Task[]>
  createTask: (taskData: Omit<Task, 'id' | 'pomodoroCompleted'>) => Promise<Task>
  updateTask: (id: string, updates: TaskPatch, setLoading?: boolean) => Promise<unknown>
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
  const autofocusTitle = ref(false)
  const pendingCreateTaskId = ref<string | null>(null)
  const tasks = isRef(store.tasks) ? store.tasks : toRef(store, 'tasks') as Ref<Task[]>
  const { rescheduleDueDate } = useRecurringReschedule({
    updateTask: (id, updates, setLoading) => store.updateTask(id, updates, setLoading),
    confirm,
  })

  function handleOpenTask(task: Task) {
    pendingCreateTaskId.value = null
    autofocusTitle.value = false
    selectedTask.value = task
    isDetailOpen.value = true
  }

  async function discardPendingIfEmpty() {
    const id = pendingCreateTaskId.value
    if (!id) return
    pendingCreateTaskId.value = null
    const task = tasks.value.find(t => t.id === id)
    if (task && (!task.title || task.title.trim() === '')) {
      try {
        await store.deleteTask(id)
      } catch (err) {
        console.error('Не удалось удалить пустую задачу:', err)
      }
    }
  }

  async function handleCreateTaskInSlot(payload: { date: Date; startMinutes: number; durationMinutes: number }) {
    await discardPendingIfEmpty()

    const dueDate = new Date(payload.date)
    dueDate.setHours(Math.floor(payload.startMinutes / 60), payload.startMinutes % 60, 0, 0)

    let created: Task
    try {
      created = await store.createTask({
        title: '',
        completed: false,
        dueDate,
        durationMinutes: payload.durationMinutes,
      } as Omit<Task, 'id' | 'pomodoroCompleted'>)
    } catch (err) {
      console.error('Не удалось создать задачу из слота календаря:', err)
      return
    }

    pendingCreateTaskId.value = created.id
    autofocusTitle.value = true
    selectedTask.value = created
    isDetailOpen.value = true
  }

  function handleDetailOpenChange(open: boolean) {
    isDetailOpen.value = open
    if (!open) {
      autofocusTitle.value = false
      void discardPendingIfEmpty()
    }
  }

  async function handleUpdateTask(updatedTask: Task) {
    if (pendingCreateTaskId.value === updatedTask.id) {
      pendingCreateTaskId.value = null
    }
    const index = tasks.value.findIndex(t => t.id === updatedTask.id)
    const previous: Task | null = index !== -1 ? { ...tasks.value[index] } as Task : null
    const optimistic: Task = shouldPromptReschedule(previous ?? undefined, updatedTask.dueDate ?? null)
      ? {
          ...updatedTask,
          recurrenceAnchorDate: previous!.recurrenceAnchorDate ?? previous!.dueDate ?? null,
        }
      : updatedTask

    if (index !== -1) tasks.value[index] = optimistic
    selectedTask.value = optimistic

    try {
      const prevDue = previous?.dueDate?.getTime() ?? null
      const nextDue = updatedTask.dueDate?.getTime() ?? null
      if (previous && prevDue !== nextDue) {
        await rescheduleDueDate(previous, updatedTask.dueDate ?? null)
      } else {
        await store.updateTask(updatedTask.id, updatedTask, false)
      }
    } catch {
      if (previous && index !== -1) {
        tasks.value[index] = previous
        selectedTask.value = previous
      }
    }
  }

  async function handleUpdateChecklist(taskId: string, items: ChecklistItem[]) {
    if (pendingCreateTaskId.value === taskId) {
      pendingCreateTaskId.value = null
    }
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

  async function handleUpdatePomodoroConfig(taskId: string, config: Record<string, unknown> | null) {
    const index = tasks.value.findIndex(t => t.id === taskId)
    const previous: Task | null = index !== -1 ? { ...tasks.value[index] } as Task : null
    const patch: Partial<Task> = config === null
      ? { isPomodoroTask: false }
      : { ...config, isPomodoroTask: true }

    if (index !== -1) {
      tasks.value[index] = { ...tasks.value[index], ...patch } as Task
    }
    if (selectedTask.value?.id === taskId) {
      selectedTask.value = { ...selectedTask.value, ...patch } as Task
    }

    try {
      await store.updatePomodoroConfig(taskId, config)
    }
    catch {
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
    autofocusTitle,
    handleOpenTask,
    handleCreateTaskInSlot,
    handleDetailOpenChange,
    handleUpdateTask,
    handleUpdateChecklist,
    handleUpdatePomodoroConfig,
    handleDeleteFromDialog,
  }
}
