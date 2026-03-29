import { ref } from 'vue'

export function useCalendarDnd() {
  const draggedTaskId = ref<string | null>(null)

  function startDrag(event: DragEvent, taskId: string) {
    draggedTaskId.value = taskId
    event.dataTransfer?.setData('text/plain', taskId)
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
    }
  }

  return {
    draggedTaskId,
    startDrag,
  }
}
