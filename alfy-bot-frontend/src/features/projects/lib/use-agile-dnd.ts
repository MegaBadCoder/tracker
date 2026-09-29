import type { useTaskStore } from '@/features/tasks/model/task-store'

interface MoveEvent {
  added?: { element: { id: string }; newIndex: number }
  moved?: { element: { id: string }; newIndex: number }
}

export function useAgileDnd(taskStore: ReturnType<typeof useTaskStore>) {
  function onTaskChange(
    event: MoveEvent,
    columnId: string,
    groupId: string | null,
    projectId: string,
    cellTasks: { id: string }[],
  ) {
    if (event.added) {
      const taskId = event.added.element.id
      const orderedIds = cellTasks.map(t => t.id)
      taskStore.moveTask(taskId, projectId, {
        columnId,
        groupId,
        order: event.added.newIndex,
      })
      if (orderedIds.length > 1) {
        taskStore.reorderTasks(projectId, orderedIds, columnId)
      }
    } else if (event.moved) {
      const orderedIds = cellTasks.map(t => t.id)
      taskStore.reorderTasks(projectId, orderedIds, columnId)
    }
  }

  return { onTaskChange }
}
