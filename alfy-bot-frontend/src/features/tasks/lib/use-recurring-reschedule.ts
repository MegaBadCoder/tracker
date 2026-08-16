import { ref } from 'vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { useConfirm } from '@/composables/useConfirm'
import type { Task, TaskPatch } from '@/features/tasks/model/types'

export const highlightedTaskId = ref<string | null>(null)

export function shouldPromptReschedule(
  task: Task | undefined,
  newDueDate: Date | null | undefined,
): boolean {
  if (!task?.recurrence) return false
  if (task.recurringParentId && !task.isAutoCreated) return false
  if (task.completed || task.isOverdue) return false
  if (newDueDate == null || !task.dueDate) return false
  return task.dueDate.getTime() !== newDueDate.getTime()
}

export interface RescheduleDeps {
  updateTask: (taskId: string, updates: TaskPatch, setLoading?: boolean) => Promise<unknown>
  confirm: (opts: {
    title: string
    message: string
    confirmText?: string
    cancelText?: string
  }) => Promise<boolean>
}

export function useRecurringReschedule(deps?: Partial<RescheduleDeps>) {
  const store = deps?.updateTask ? null : useTaskStore()
  const updateTask =
    deps?.updateTask ??
    ((id: string, updates: TaskPatch, setLoading?: boolean) =>
      store!.updateTask(id, updates, setLoading))
  const confirm = deps?.confirm ?? useConfirm().confirm

  async function rescheduleDueDate(task: Task, newDueDate: Date | null) {
    if (!shouldPromptReschedule(task, newDueDate)) {
      await updateTask(task.id, { dueDate: newDueDate }, false)
      return
    }

    highlightedTaskId.value = task.id
    try {
      await updateTask(
        task.id,
        { dueDate: newDueDate, rescheduleScope: 'this' },
        false,
      )
      const shiftSubsequent = await confirm({
        title: 'Сместить расписание?',
        message: 'Сместить все последующие или только текущую?',
        confirmText: 'Сместить все',
        cancelText: 'Текущую',
      })
      if (shiftSubsequent) {
        await updateTask(task.id, { rescheduleScope: 'subsequent' }, false)
      }
    } finally {
      highlightedTaskId.value = null
    }
  }

  return { rescheduleDueDate, highlightedTaskId }
}
