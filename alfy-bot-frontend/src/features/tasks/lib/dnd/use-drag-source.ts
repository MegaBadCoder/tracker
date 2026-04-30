import type { Ref } from 'vue'
import type { DragSession } from './types'
import type { Task } from '@/features/tasks/model/types'
import { onMounted, onUnmounted } from 'vue'
import { useTaskDnd } from './use-task-dnd'

const MOUSE_DRAG_THRESHOLD_PX = 5
const TOUCH_DRAG_THRESHOLD_PX = 8
const LONG_PRESS_DELAY_MS = 350

function buildSession(
  task: Task,
  event: PointerEvent,
  cardEl: HTMLElement,
): DragSession {
  const originRect = cardEl.getBoundingClientRect()
  return {
    task,
    pointerType: event.pointerType as 'mouse' | 'touch' | 'pen',
    originRect,
    ghostOffset: {
      x: event.clientX - originRect.left,
      y: event.clientY - originRect.top,
    },
    pointerId: event.pointerId,
  }
}

function triggerHaptic(): void {
  ;(window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light')
}

export function useDragSource(opts: {
  task: Ref<Task>
  cardEl: Ref<HTMLElement | null>
  handleEl: Ref<HTMLElement | null>
  onTap: () => void
}): void {
  const dnd = useTaskDnd()

  // ── Handle: immediate drag on pointerdown ────────────────────────────────
  function onHandlePointerDown(event: PointerEvent): void {
    event.preventDefault()
    event.stopPropagation()

    const card = opts.cardEl.value
    if (!card)
      return

    const handleTarget = event.target as HTMLElement
    handleTarget.setPointerCapture(event.pointerId)

    const session = buildSession(opts.task.value, event, card)
    dnd.start(session, { x: event.clientX, y: event.clientY })
  }

  // ── Card: threshold-based drag ───────────────────────────────────────────
  function onCardPointerDown(event: PointerEvent): void {
    const handle = opts.handleEl.value
    const card = opts.cardEl.value
    if (!card)
      return

    // If the pointer is on [data-no-drag] element, skip.
    const target = event.target as HTMLElement
    if (target.closest('[data-no-drag]'))
      return

    // If the pointer is on the handle, let onHandlePointerDown take over.
    if (handle && (target === handle || handle.contains(target)))
      return

    if (event.pointerType === 'mouse') {
      handleMouseDown(event, card)
    }
    else {
      // touch or pen
      handleTouchDown(event, card)
    }
  }

  // Mouse: drag starts after exceeding threshold while button held.
  function handleMouseDown(event: PointerEvent, card: HTMLElement): void {
    const startX = event.clientX
    const startY = event.clientY
    let dragStarted = false

    function onMove(e: PointerEvent): void {
      if (dragStarted)
        return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (Math.sqrt(dx * dx + dy * dy) > MOUSE_DRAG_THRESHOLD_PX) {
        dragStarted = true
        cleanup()
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        const session = buildSession(opts.task.value, event, card)
        dnd.start(session, { x: e.clientX, y: e.clientY })
      }
    }

    function onUp(_e: PointerEvent): void {
      cleanup()
      if (!dragStarted)
        opts.onTap()
    }

    function cleanup(): void {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  // Touch/pen: drag starts after long-press; cancels on early move > threshold.
  function handleTouchDown(event: PointerEvent, card: HTMLElement): void {
    const startX = event.clientX
    const startY = event.clientY
    let timerFired = false

    const timerId = window.setTimeout(() => {
      timerFired = true
      cleanup()
      triggerHaptic()
      ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
      const session = buildSession(opts.task.value, event, card)
      dnd.start(session, { x: event.clientX, y: event.clientY })
    }, LONG_PRESS_DELAY_MS)

    function onMove(e: PointerEvent): void {
      if (timerFired)
        return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (Math.sqrt(dx * dx + dy * dy) > TOUCH_DRAG_THRESHOLD_PX) {
        // Moved too much before long-press fired — treat as scroll, cancel.
        cleanup()
      }
    }

    function onUp(_e: PointerEvent): void {
      cleanup()
      if (!timerFired)
        opts.onTap()
    }

    function cleanup(): void {
      clearTimeout(timerId)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  onMounted(() => {
    const card = opts.cardEl.value
    const handle = opts.handleEl.value

    if (card) {
      card.addEventListener('pointerdown', onCardPointerDown)
    }
    if (handle) {
      handle.addEventListener('pointerdown', onHandlePointerDown)
    }
  })

  onUnmounted(() => {
    const card = opts.cardEl.value
    const handle = opts.handleEl.value

    if (card) {
      card.removeEventListener('pointerdown', onCardPointerDown)
    }
    if (handle) {
      handle.removeEventListener('pointerdown', onHandlePointerDown)
    }
  })
}
