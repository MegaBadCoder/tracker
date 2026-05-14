import type { ComputedRef, Ref } from 'vue'
import type { ReorderListRegistration } from './types'
import { computed, onMounted, onUnmounted, watch } from 'vue'
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
  scope: string | (() => string)
  listEl: Ref<HTMLElement | null>
  getItems: () => { id: string, el: HTMLElement }[]
}): { insertionIndex: ComputedRef<number | null> } {
  const dnd = useTaskDnd()
  const getScope = typeof opts.scope === 'function' ? opts.scope : () => opts.scope as string

  let currentScope = getScope()

  function buildRegistration(scope: string): ReorderListRegistration {
    return {
      scope,
      get listEl(): HTMLElement | null {
        return opts.listEl.value
      },
      getItems: opts.getItems,
    }
  }

  onMounted(() => {
    currentScope = getScope()
    dnd.registerReorderList(buildRegistration(currentScope))
  })

  // Re-register when scope changes (e.g. project navigation reuses ProjectView).
  if (typeof opts.scope === 'function') {
    watch(opts.scope, (newScope) => {
      if (newScope === currentScope)
        return
      dnd.unregisterReorderList(currentScope)
      currentScope = newScope
      dnd.registerReorderList(buildRegistration(currentScope))
    })
  }

  onUnmounted(() => {
    dnd.unregisterReorderList(currentScope)
  })

  const insertionIndex = computed<number | null>(() => {
    if (!dnd.state.active)
      return null
    if (dnd.state.hoveredList?.scope !== currentScope)
      return null
    return dnd.state.insertionIndex
  })

  return { insertionIndex }
}
