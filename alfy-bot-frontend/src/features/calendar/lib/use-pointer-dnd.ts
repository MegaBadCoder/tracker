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
  onClicked?: (event: CalendarEvent) => void
  onResized?: (taskId: string, durationMinutes: number) => Promise<void>
}

function formatMinutes(m: number): string {
  const hours = Math.floor(m / 60) % 24
  const mins = m % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

const MIN_RESIZE_DURATION = 15

export function usePointerDnd(options: PointerDndOptions) {
  const isDragging = ref(false)
  const showOverlay = ref(false)
  const draggedEvent = ref<CalendarEvent | null>(null)
  const dragMode = ref<'move' | 'resize'>('move')
  const overlayTop = ref(0)
  const overlayLeft = ref(0)
  const overlayHeight = ref(20)
  const previewMinutes = ref(0)
  const previewDate = ref<Date>(new Date())

  const draggedTaskId = computed(() => draggedEvent.value?.taskId ?? null)

  const overlayStyle = computed<CSSProperties>(() => ({
    position: 'absolute',
    top: `${overlayTop.value}px`,
    left: `${overlayLeft.value}px`,
    width: `${options.dayWidth - 4}px`,
  }))

  const overlayTimeLabel = computed(() => {
    const start = previewMinutes.value
    const end = dragMode.value === 'resize'
      ? start + overlayHeight.value
      : start + (draggedEvent.value?.durationMinutes ?? 0)
    return `${formatMinutes(start)}\u2013${formatMinutes(end)}`
  })

  function onGrab(event: CalendarEvent, e: PointerEvent) {
    const track = options.trackEl.value
    if (!track) return

    isDragging.value = true
    showOverlay.value = false
    dragMode.value = 'move'
    draggedEvent.value = event
    overlayHeight.value = Math.max(event.durationMinutes, 20)

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
      } else if (!showOverlay.value && options.onClicked) {
        options.onClicked(event)
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

  function onResizeStart(event: CalendarEvent, e: PointerEvent) {
    const track = options.trackEl.value
    if (!track) return

    isDragging.value = true
    showOverlay.value = false
    dragMode.value = 'resize'
    draggedEvent.value = event
    overlayHeight.value = event.durationMinutes
    overlayTop.value = event.startMinutes
    previewMinutes.value = event.startMinutes
    previewDate.value = event.date

    const trackRect = track.getBoundingClientRect()
    overlayLeft.value = options.dayOffset(event.date) + 2

    track.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      const y = ev.clientY - trackRect.top
      const newBottom = Math.max(0, Math.min(Math.round(y / 5) * 5, MAX_MINUTES + 5))
      const newDuration = Math.max(newBottom - event.startMinutes, MIN_RESIZE_DURATION)
      overlayHeight.value = newDuration

      if (!showOverlay.value) showOverlay.value = true
    }

    const cleanup = () => {
      track.removeEventListener('pointermove', onMove)
      track.removeEventListener('pointerup', onUp)
      track.removeEventListener('pointercancel', onCancel)
      isDragging.value = false
      showOverlay.value = false
      draggedEvent.value = null
      dragMode.value = 'move'
    }

    const onUp = async () => {
      track.removeEventListener('pointermove', onMove)
      track.removeEventListener('pointerup', onUp)
      track.removeEventListener('pointercancel', onCancel)
      isDragging.value = false

      if (overlayHeight.value !== event.durationMinutes && options.onResized) {
        await options.onResized(event.taskId, overlayHeight.value)
      }

      showOverlay.value = false
      draggedEvent.value = null
      dragMode.value = 'move'
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
    dragMode,
    draggedTaskId,
    draggedEvent,
    overlayStyle,
    overlayHeight,
    overlayTimeLabel,
    onGrab,
    onResizeStart,
  }
}
