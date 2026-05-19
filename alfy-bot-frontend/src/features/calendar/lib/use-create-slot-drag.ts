import { ref, computed, type Ref, type CSSProperties } from 'vue'

const MAX_MINUTES = 23 * 60 + 55
const SHOW_OVERLAY_THRESHOLD_PX = 3
const SNAP_MIN = 5
const LONG_PRESS_DELAY_MS = 350
const TOUCH_DRAG_THRESHOLD_PX = 8

export interface CreateSlotDragOptions {
  trackEl: Ref<HTMLElement | null>
  dayOffset: (date: Date) => number
  dateFromX: (x: number) => Date
  dayWidth: number
  onCreated: (date: Date, startMinutes: number, durationMinutes: number) => Promise<void>
}

function snap(px: number): number {
  return Math.max(0, Math.min(Math.round(px / SNAP_MIN) * SNAP_MIN, MAX_MINUTES))
}

function formatMinutes(m: number): string {
  const hours = Math.floor(m / 60) % 24
  const mins = m % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function triggerHaptic(): void {
  ;(window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light')
}

export function useCreateSlotDrag(options: CreateSlotDragOptions) {
  const showOverlay = ref(false)
  const overlayTop = ref(0)
  const overlayLeft = ref(0)
  const overlayHeight = ref(SNAP_MIN)
  const startMinutes = ref(0)

  const overlayStyle = computed<CSSProperties>(() => ({
    position: 'absolute',
    top: `${overlayTop.value}px`,
    left: `${overlayLeft.value}px`,
    width: `${options.dayWidth - 4}px`,
  }))

  const overlayTimeLabel = computed(() => {
    const start = startMinutes.value
    const end = start + overlayHeight.value
    return `${formatMinutes(start)}–${formatMinutes(end)}`
  })

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    if (e.ctrlKey || e.metaKey) return
    const target = e.target as HTMLElement | null
    if (!target) return
    if (target.closest('[data-calendar-event-block]')) return

    const track = options.trackEl.value
    if (!track) return

    const rect = track.getBoundingClientRect()
    const initialX = e.clientX - rect.left
    const initialY = e.clientY - rect.top
    const initialDate = options.dateFromX(initialX)
    const initialMinutes = snap(initialY)
    const initialClientX = e.clientX
    const initialClientY = e.clientY
    const pointerId = e.pointerId

    const startDrag = () => {
      startMinutes.value = initialMinutes
      overlayTop.value = initialMinutes
      overlayLeft.value = options.dayOffset(initialDate) + 2
      overlayHeight.value = SNAP_MIN
      showOverlay.value = false

      track.setPointerCapture(pointerId)

      const onMove = (ev: PointerEvent) => {
        const r = track.getBoundingClientRect()
        const y = ev.clientY - r.top

        if (!showOverlay.value) {
          const dx = Math.abs(ev.clientX - rect.left - initialX)
          const dy = Math.abs(y - initialY)
          if (dx < SHOW_OVERLAY_THRESHOLD_PX && dy < SHOW_OVERLAY_THRESHOLD_PX) return
          showOverlay.value = true
        }

        const endMinutes = snap(y)
        overlayHeight.value = Math.max(SNAP_MIN, endMinutes - initialMinutes)
      }

      const cleanup = () => {
        track.removeEventListener('pointermove', onMove)
        track.removeEventListener('pointerup', onUp)
        track.removeEventListener('pointercancel', onCancel)
      }

      const onUp = async () => {
        cleanup()
        const wasDrag = showOverlay.value
        const duration = overlayHeight.value
        showOverlay.value = false
        if (wasDrag) {
          await options.onCreated(initialDate, initialMinutes, duration)
        }
      }

      const onCancel = () => {
        cleanup()
        showOverlay.value = false
      }

      track.addEventListener('pointermove', onMove)
      track.addEventListener('pointerup', onUp)
      track.addEventListener('pointercancel', onCancel)
    }

    if (e.pointerType === 'mouse') {
      startDrag()
      return
    }

    // touch / pen: long-press 350ms with cancel on early movement > 8px
    let timerFired = false

    const timerId = window.setTimeout(() => {
      timerFired = true
      cleanupWait()
      triggerHaptic()
      startDrag()
    }, LONG_PRESS_DELAY_MS)

    function onWaitMove(ev: PointerEvent) {
      if (timerFired) return
      const dx = ev.clientX - initialClientX
      const dy = ev.clientY - initialClientY
      if (Math.sqrt(dx * dx + dy * dy) > TOUCH_DRAG_THRESHOLD_PX) {
        cleanupWait()
      }
    }

    function onWaitEnd() {
      if (!timerFired) cleanupWait()
    }

    function cleanupWait() {
      clearTimeout(timerId)
      window.removeEventListener('pointermove', onWaitMove)
      window.removeEventListener('pointerup', onWaitEnd)
      window.removeEventListener('pointercancel', onWaitEnd)
    }

    window.addEventListener('pointermove', onWaitMove)
    window.addEventListener('pointerup', onWaitEnd)
    window.addEventListener('pointercancel', onWaitEnd)
  }

  return {
    showOverlay,
    overlayStyle,
    overlayHeight,
    overlayTimeLabel,
    onPointerDown,
  }
}
