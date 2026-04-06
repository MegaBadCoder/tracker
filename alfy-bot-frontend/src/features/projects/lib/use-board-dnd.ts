import type { useTaskStore } from '@/features/tasks/model/task-store'
import type { useColumnStore } from '../model/column-store'

interface MoveEvent {
  added?: { element: { id: string }; newIndex: number }
  moved?: { element: { id: string }; newIndex: number }
}

export function useBoardDnd(
  taskStore: ReturnType<typeof useTaskStore>,
  columnStore: ReturnType<typeof useColumnStore>,
) {
  function onTaskChange(event: MoveEvent, columnId: string | null, projectId: string, columnTasks: { id: string }[]) {
    if (event.added) {
      const taskId = event.added.element.id
      const orderedIds = columnTasks.map(t => t.id)
      taskStore.moveTask(taskId, projectId, { columnId, order: event.added.newIndex })
      if (orderedIds.length > 1) {
        taskStore.reorderTasks(projectId, orderedIds, columnId ?? undefined)
      }
    } else if (event.moved) {
      const orderedIds = columnTasks.map(t => t.id)
      taskStore.reorderTasks(projectId, orderedIds, columnId ?? undefined)
    }
  }

  function onColumnReorder(projectId: string, orderedColumns: { id: string }[]) {
    const orderedIds = orderedColumns.map(c => c.id)
    columnStore.reorderColumns(projectId, orderedIds)
  }

  return { onTaskChange, onColumnReorder }
}
