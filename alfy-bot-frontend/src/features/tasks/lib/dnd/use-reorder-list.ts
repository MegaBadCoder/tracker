import type { ComputedRef, Ref } from 'vue'
import type { ReorderListRegistration } from './types'
import { computed, onMounted, onUnmounted } from 'vue'
import { useTaskDnd } from './use-task-dnd'

/**
 * Computes the insertion index for a dragged item given the current pointer Y
 * and the list of item rects (sorted by visual order, top-to-bottom).
 *
 * Returns:
 *   0                  — pointer is above the center of the first item
 *   items.length       — pointer is below the center of the last item
 *   i (0 < i < len)   — pointer is between center of item[i-1] and center of item[i]
 *
 * Empty list → 0.
 */
export function computeInsertionIndex(
  pointerY: number,
  items: { rect: { top: number, bottom: number }, id: string }[],
): number {
  if (items.length === 0)
    return 0

  for (let i = 0; i < items.length; i++) {
    const { top, bottom } = items[i]!.rect
    const center = (top + bottom) / 2
    if (pointerY < center)
      return i
  }

  return items.length
}

export function useReorderList(opts: {
  scope: string
  listEl: Ref<HTMLElement | null>
  getItems: () => { id: string, el: HTMLElement }[]
}): { insertionIndex: ComputedRef<number | null> } {
  const dnd = useTaskDnd()

  const registration: ReorderListRegistration = {
    scope: opts.scope,
    get listEl(): HTMLElement {
      if (!opts.listEl.value)
        throw new Error(`useReorderList: listEl is null for scope "${opts.scope}"`)
      return opts.listEl.value
    },
    getItems: opts.getItems,
  }

  onMounted(() => {
    dnd.registerReorderList(registration)
  })

  onUnmounted(() => {
    dnd.unregisterReorderList(opts.scope)
  })

  const insertionIndex = computed<number | null>(() => {
    if (!dnd.state.active)
      return null
    if (dnd.state.hoveredList?.scope !== opts.scope)
      return null
    return dnd.state.insertionIndex
  })

  return { insertionIndex }
}
