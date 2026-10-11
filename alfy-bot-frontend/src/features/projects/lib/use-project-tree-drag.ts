import type { Ref } from 'vue'
import type { ProjectTreeNode } from '../model/types'
import type { ProjectDestination, ProjectTreeRow } from './project-tree-drag'
import { computed, onUnmounted, ref } from 'vue'
import { computeInsertionIndex } from '@/features/tasks/lib/dnd/use-reorder-list'
import { flattenProjects, PROJECT_INDENT, projectDestination } from './project-tree-drag'

const LONG_PRESS_DELAY = 350
const PRESS_MOVE_THRESHOLD = 8
const SCROLL_EDGE = 40
const SCROLL_SPEED = 450

interface DragState {
  row: ProjectTreeRow
  pointerId: number
  startX: number
  startY: number
  x: number
  y: number
  active: boolean
}

/** Начинает перенос ветки после удержания 350 мс; движение более 8 px до активации оставляет прокрутку браузеру. Вызывает commit только при отпускании внутри списка; Escape и pointercancel отменяют перенос. */
export function useProjectTreeDrag(
  list: Ref<HTMLElement | null>,
  nodes: () => ProjectTreeNode[],
  collapsed: () => Set<string>,
  disabled: () => boolean,
  commit: (id: string, destination: ProjectDestination) => void,
) {
  const drag = ref<DragState | null>(null)
  const destination = ref<ProjectDestination | null>(null)
  const lineTop = ref(0)
  const rows = computed(() => flattenProjects(nodes(), collapsed(), null))
  let pressTimer = 0
  let suppressClick = false
  let frame = 0
  let lastTime = 0

  function candidates() {
    return flattenProjects(nodes(), collapsed(), drag.value?.row.node.id ?? null)
  }

  function updateDestination() {
    const state = drag.value
    const root = list.value
    if (!state?.active || !root)
      return
    const bounds = root.getBoundingClientRect()
    const viewport = root.closest('[data-sidebar-scroll]')?.getBoundingClientRect() ?? bounds
    if (state.x < bounds.left || state.x > bounds.right || state.y < Math.max(bounds.top, viewport.top) || state.y > Math.min(bounds.bottom + SCROLL_EDGE, viewport.bottom)) {
      destination.value = null
      return
    }
    const available = candidates()
    const elements = new Map(Array.from(root.querySelectorAll<HTMLElement>('[data-tree-row]')).map(el => [el.dataset.treeRow, el]))
    const items = available.map(row => ({ id: row.node.id, rect: elements.get(row.node.id)!.getBoundingClientRect() }))
    const index = computeInsertionIndex(state.y, items)
    const desiredDepth = state.row.depth + Math.round((state.x - state.startX) / PROJECT_INDENT)
    destination.value = projectDestination(available, index, desiredDepth)
    const next = items[destination.value.index]
    const previous = items[destination.value.index - 1]
    lineTop.value = (next?.rect.top ?? previous?.rect.bottom ?? bounds.top) - bounds.top
  }

  function scrollFrame(time: number) {
    if (!drag.value?.active)
      return
    const panel = list.value?.closest<HTMLElement>('[data-sidebar-scroll]')
    if (panel) {
      const bounds = panel.getBoundingClientRect()
      const y = drag.value.y
      const direction = y < bounds.top + SCROLL_EDGE ? -1 : y > bounds.bottom - SCROLL_EDGE ? 1 : 0
      const elapsed = lastTime ? Math.min(time - lastTime, 32) : 0
      panel.scrollTop += direction * SCROLL_SPEED * elapsed / 1000
    }
    lastTime = time
    updateDestination()
    frame = requestAnimationFrame(scrollFrame)
  }

  function pointerMove(event: PointerEvent) {
    const state = drag.value
    if (!state || state.pointerId !== event.pointerId)
      return
    state.x = event.clientX
    state.y = event.clientY
    if (!state.active && Math.hypot(state.x - state.startX, state.y - state.startY) > PRESS_MOVE_THRESHOLD) {
      suppressClick = true
      cancel()
      return
    }
    if (state.active)
      event.preventDefault()
    updateDestination()
  }

  function cancel() {
    clearTimeout(pressTimer)
    drag.value = null
    destination.value = null
    cancelAnimationFrame(frame)
    lastTime = 0
    window.removeEventListener('pointermove', pointerMove)
    window.removeEventListener('pointerup', pointerUp)
    window.removeEventListener('pointercancel', cancel)
    window.removeEventListener('keydown', keyDown)
    window.removeEventListener('blur', cancel)
    window.removeEventListener('touchmove', preventActiveScroll)
  }

  function pointerUp(event: PointerEvent) {
    if (drag.value?.pointerId !== event.pointerId)
      return
    pointerMove(event)
    const state = drag.value
    const target = destination.value
    cancel()
    if (state?.active && target && !disabled())
      commit(state.row.node.id, target)
  }

  function keyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    }
  }

  function start(row: ProjectTreeRow, event: PointerEvent) {
    if (disabled() || event.button !== 0 || !event.isPrimary)
      return
    cancel()
    suppressClick = false
    drag.value = { row, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false }
    pressTimer = window.setTimeout(() => {
      if (!drag.value || disabled()) {
        cancel()
        return
      }
      drag.value.active = true
      suppressClick = true
      updateDestination()
      frame = requestAnimationFrame(scrollFrame)
    }, LONG_PRESS_DELAY)
    window.addEventListener('touchmove', preventActiveScroll, { passive: false })
    window.addEventListener('pointermove', pointerMove, { passive: false })
    window.addEventListener('pointerup', pointerUp)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', keyDown)
    window.addEventListener('blur', cancel)
  }

  function preventActiveScroll(event: TouchEvent) {
    if (drag.value?.active && event.cancelable) event.preventDefault()
  }

  function preventDragClick(event: MouseEvent) {
    if (!suppressClick || event.detail === 0) return
    suppressClick = false
    if (!(event.target instanceof Element) || !event.target.closest('[data-project-id]')) return
    event.preventDefault()
    event.stopPropagation()
  }

  onUnmounted(cancel)
  return { rows, drag, destination, lineTop, start, preventDragClick }
}
