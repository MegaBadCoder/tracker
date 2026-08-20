import type { useTaskStore } from '@/features/tasks/model/task-store'
import { alog } from './agile-debug'

interface MoveEvent {
  added?: { element: { id: string }; newIndex: number }
  moved?: { element: { id: string }; newIndex: number }
}

export function useAgileDnd(taskStore: ReturnType<typeof useTaskStore>) {
  function onTaskChange(
    event: MoveEvent,
    columnId: string | null,
    // undefined means "don't touch groupId" — used when dropping into the
    // backlog panel, where an explicit null would wipe the task's epic/story.
    groupId: string | null | undefined,
    projectId: string,
    cellTasks: { id: string }[],
  ) {
    if (event.added) {
      const taskId = event.added.element.id
      const orderedIds = cellTasks.map(t => t.id)
      const payload: { columnId: string | null, groupId?: string | null, order: number } = {
        columnId,
        order: event.added.newIndex,
      }
      if (groupId !== undefined)
        payload.groupId = groupId
      alog('4. added → отправляю moveTask', { taskId, columnId, groupId, order: event.added.newIndex })
      taskStore.moveTask(taskId, projectId, payload)
      if (orderedIds.length > 1) {
        taskStore.reorderTasks(projectId, orderedIds, columnId ?? undefined)
      }
    } else if (event.moved) {
      const orderedIds = cellTasks.map(t => t.id)
      alog('4. moved (внутри той же ячейки) → только reorder', { columnId, groupId })
      taskStore.reorderTasks(projectId, orderedIds, columnId ?? undefined)
    } else {
      alog('4. change без added/moved — ничего не отправляю', { keys: Object.keys(event) })
    }
  }

  return { onTaskChange }
}
