import type { Ref } from 'vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

interface MapBounds { width: number, height: number, x?: number }
interface MapPoint { x: number, y: number }

/** Управляет масштабом и положением полотна в пикселях контейнера, не изменяя узлы карты. */
export function useSprintMapViewport(element: Ref<HTMLElement | null>) {
  const x = ref(0)
  const y = ref(0)
  const scale = ref(1)
  const minScale = ref(0.08)
  const dragging = ref(false)
  const size = ref({ width: 960, height: 600 })
  let pointer: { id: number, x: number, y: number } | null = null
  let observer: ResizeObserver | undefined
  const transform = computed(() => `translate(${x.value}px, ${y.value}px) scale(${scale.value})`)

  function measure() {
    const rect = element.value?.getBoundingClientRect()
    if (rect?.width && rect.height)
      size.value = { width: rect.width, height: rect.height }
  }

  function zoom(next: number, point: MapPoint = { x: size.value.width / 2, y: size.value.height / 2 }) {
    const clamped = Math.min(1.75, Math.max(minScale.value, next))
    const ratio = clamped / scale.value
    x.value = point.x - (point.x - x.value) * ratio
    y.value = point.y - (point.y - y.value) * ratio
    scale.value = clamped
  }

  function focus(point: MapPoint) {
    x.value = size.value.width / 2 - point.x * scale.value
    y.value = size.value.height / 2 - point.y * scale.value
  }

  function fit(bounds: MapBounds) {
    measure()
    scale.value = Math.max(Number.EPSILON, Math.min(1, (size.value.width - 40) / bounds.width, (size.value.height - 40) / bounds.height))
    minScale.value = Math.min(0.08, scale.value)
    focus({ x: (bounds.x ?? 0) + bounds.width / 2, y: bounds.height / 2 })
  }

  function initialize(bounds: MapBounds, root: MapPoint) {
    fit(bounds)
    if (scale.value < 0.65) {
      scale.value = 0.8
      focus(root)
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || (event.target as Element).closest('button, a, input, select, textarea, [data-map-node]'))
      return
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
    dragging.value = true
    element.value?.setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId)
      return
    x.value += event.clientX - pointer.x
    y.value += event.clientY - pointer.y
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }

  function onPointerUp(event: PointerEvent) {
    if (pointer?.id !== event.pointerId)
      return
    if (element.value?.hasPointerCapture?.(event.pointerId))
      element.value.releasePointerCapture(event.pointerId)
    pointer = null
    dragging.value = false
  }

  function onWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
      const rect = element.value?.getBoundingClientRect()
      zoom(scale.value * Math.exp(-event.deltaY * 0.008), { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) })
    }
    else {
      x.value -= event.deltaX
      y.value -= event.deltaY
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget)
      return
    const delta = 64
    switch (event.key) {
      case 'ArrowLeft':
        x.value += delta
        break
      case 'ArrowRight':
        x.value -= delta
        break
      case 'ArrowUp':
        y.value += delta
        break
      case 'ArrowDown':
        y.value -= delta
        break
      case '+':
      case '=':
        zoom(scale.value * 1.2)
        break
      case '-':
        zoom(scale.value / 1.2)
        break
      default: return
    }
    event.preventDefault()
  }

  onMounted(() => {
    measure()
    if (typeof ResizeObserver !== 'undefined' && element.value) {
      observer = new ResizeObserver(measure)
      observer.observe(element.value)
    }
  })
  onBeforeUnmount(() => observer?.disconnect())

  return { x, y, scale, minScale, dragging, transform, zoom, focus, fit, initialize, onPointerDown, onPointerMove, onPointerUp, onWheel, onKeyDown }
}
