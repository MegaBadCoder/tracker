import type { ComputedRef, Ref } from 'vue'
import type { DropTargetKind } from './types'
import { computed, onMounted, onUnmounted } from 'vue'
import { useTaskDnd } from './use-task-dnd'

export function useDropTarget(opts: {
  id: string
  kind: DropTargetKind
  el: Ref<HTMLElement | null>
  projectId?: string
}): { isHovered: ComputedRef<boolean> } {
  const dnd = useTaskDnd()

  onMounted(() => {
    const el = opts.el.value
    if (!el)
      throw new Error(`useDropTarget: el is null for id "${opts.id}"`)

    dnd.register({
      id: opts.id,
      kind: opts.kind,
      el,
      projectId: opts.projectId,
    })
  })

  onUnmounted(() => {
    dnd.unregister(opts.id)
  })

  const isHovered = computed<boolean>(() => {
    return dnd.state.hoveredTarget?.id === opts.id
  })

  return { isHovered }
}
