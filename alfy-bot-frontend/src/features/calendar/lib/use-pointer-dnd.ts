import { ref, computed, type Ref, type CSSProperties } from 'vue'
import { startOfDay } from 'date-fns'
import type { CalendarEvent } from '../model/types'

const MAX_MINUTES = 23 * 60 + 55

export interface PointerDndOptions {
  trackEl: Ref<HTMLElement | null>
  dayOffset: (date: Date) => number
  dateFromX: (x: number) => Date
  dayWidth: number
  onMoved: (taskId: string, newDate: Date, startMinutes: number) => Promise<void>
}

function formatMinutes(m: number): string {
  const hours = Math.floor(m / 60) % 24
  const mins = m % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function usePointerDnd(options: PointerDndOptions) {
  const isDragging = ref(false)
  const showOverlay = ref(false)
  const draggedEvent = ref<CalendarEvent | null>(null)
  const overlayTop = ref(0)
  const overlayLeft = ref(0)
  const previewMinutes = ref(0)
  const previewDate = ref<Date>(new Date())

  const draggedTaskId = computed(() => draggedEvent.value?.taskId ?? null)

  const overlayStyle = computed<CSSProperties>(() => ({
    position: 'absolute',
    top: `${overlayTop.value}px`,
    left: `${overlayLeft.value}px`,
    width: `${options.dayWidth - 4}px`,
  }))

  const overlayHeight = computed(() => {
    if (!draggedEvent.value) return 20
    return Math.max(draggedEvent.value.durationMinutes, 20)
  })

  const overlayTimeLabel = computed(() => {
    const start = previewMinutes.value
    const dur = draggedEvent.value?.durationMinutes ?? 0
    return `${formatMinutes(start)}\u2013${formatMinutes(start + dur)}`
  })

  function onGrab(event: CalendarEvent, e: PointerEvent) {
    const track = options.trackEl.value
    if (!track) return

    isDragging.value = true
    showOverlay.value = false
    draggedEvent.value = event

    const trackRect = track.getBoundingClientRect()
    const pointerY = e.clientY - trackRect.top
    const offsetY = pointerY - event.startMinutes

    previewMinutes.value = event.startMinutes
    previewDate.value = event.date

    track.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      const rect = track.getBoundingClientRect()
      const x = ev.clientX - rect.left
      const y = ev.clientY - rect.top

      const newTop = y - offsetY
      const snapped = Math.max(0, Math.min(Math.round(newTop / 5) * 5, MAX_MINUTES))
      overlayTop.value = snapped
      previewMinutes.value = snapped

      const date = options.dateFromX(x)
      previewDate.value = date
      overlayLeft.value = options.dayOffset(date) + 2

      if (!showOverlay.value) showOverlay.value = true
    }

    const cleanup = () => {
      track.removeEventListener('pointermove', onMove)
      track.removeEventListener('pointerup', onUp)
      track.removeEventListener('pointercancel', onCancel)
      isDragging.value = false
      showOverlay.value = false
      draggedEvent.value = null
    }

    const onUp = async () => {
      track.removeEventListener('pointermove', onMove)
      track.removeEventListener('pointerup', onUp)
      track.removeEventListener('pointercancel', onCancel)
      isDragging.value = false

      const movedTime = previewMinutes.value !== event.startMinutes
      const movedDay = startOfDay(previewDate.value).getTime() !== startOfDay(event.date).getTime()

      if (movedTime || movedDay) {
        await options.onMoved(event.taskId, previewDate.value, previewMinutes.value)
      }

      showOverlay.value = false
      draggedEvent.value = null
    }

    const onCancel = () => {
      cleanup()
    }

    track.addEventListener('pointermove', onMove)
    track.addEventListener('pointerup', onUp)
    track.addEventListener('pointercancel', onCancel)
  }

  return {
    isDragging,
    showOverlay,
    draggedTaskId,
    draggedEvent,
    overlayStyle,
    overlayHeight,
    overlayTimeLabel,
    onGrab,
  }
}
