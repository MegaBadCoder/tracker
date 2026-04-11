import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { usePointerDnd } from '@/features/calendar/lib/use-pointer-dnd'
import type { CalendarEvent } from '@/features/calendar/model/types'
import type { Task } from '@/features/tasks/model/types'

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: '1',
  title: 'Test',
  completed: false,
  pomodoroCompleted: 0,
  ...overrides,
})

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  taskId: '1',
  title: 'Test',
  date: new Date('2026-04-10T10:00:00'),
  startMinutes: 600,
  durationMinutes: 60,
  isAllDay: false,
  task: makeTask(),
  completed: false,
  ...overrides,
})

function createMockTrack() {
  const listeners = new Map<string, Function>()
  const el = {
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 1000, height: 1440 }),
    setPointerCapture: vi.fn(),
    addEventListener: (type: string, fn: Function) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
  } as unknown as HTMLElement
  return { el, listeners }
}

describe('usePointerDnd', () => {
  let onMoved: ReturnType<typeof vi.fn>
  let onClicked: ReturnType<typeof vi.fn>
  let track: ReturnType<typeof createMockTrack>

  beforeEach(() => {
    onMoved = vi.fn().mockResolvedValue(undefined)
    onClicked = vi.fn()
    track = createMockTrack()
  })

  function setup() {
    const trackEl = ref<HTMLElement | null>(track.el)
    return usePointerDnd({
      trackEl,
      dayOffset: () => 0,
      dateFromX: () => new Date('2026-04-10'),
      dayWidth: 150,
      onMoved,
      onClicked,
    })
  }

  // Позитивные

  it('onClicked вызывается при pointerdown + pointerup без pointermove', () => {
    const { onGrab } = setup()
    const event = makeEvent()
    const pointerEvent = new PointerEvent('pointerdown', { clientX: 100, clientY: 650, pointerId: 1 })

    onGrab(event, pointerEvent)

    // Simulate pointerup without any pointermove
    const onUp = track.listeners.get('pointerup')
    expect(onUp).toBeDefined()
    onUp!(new PointerEvent('pointerup'))

    expect(onClicked).toHaveBeenCalledOnce()
    expect(onClicked).toHaveBeenCalledWith(event)
  })

  it('onClicked получает правильный CalendarEvent', () => {
    const { onGrab } = setup()
    const event = makeEvent({ taskId: 'task-42', title: 'My task' })
    const pointerEvent = new PointerEvent('pointerdown', { clientX: 100, clientY: 650, pointerId: 1 })

    onGrab(event, pointerEvent)
    track.listeners.get('pointerup')!(new PointerEvent('pointerup'))

    expect(onClicked.mock.calls[0]![0]).toMatchObject({
      taskId: 'task-42',
      title: 'My task',
    })
  })

  // Негативные

  it('onClicked НЕ вызывается если был pointermove', () => {
    const { onGrab } = setup()
    const event = makeEvent()
    const pointerEvent = new PointerEvent('pointerdown', { clientX: 100, clientY: 650, pointerId: 1 })

    onGrab(event, pointerEvent)

    // Simulate pointermove (triggers overlay)
    const onMove = track.listeners.get('pointermove')
    expect(onMove).toBeDefined()
    onMove!(new PointerEvent('pointermove', { clientX: 200, clientY: 700 }))

    // Then pointerup
    track.listeners.get('pointerup')!(new PointerEvent('pointerup'))

    expect(onClicked).not.toHaveBeenCalled()
  })

  it('onMoved НЕ вызывается при отсутствии движения', () => {
    const { onGrab } = setup()
    const event = makeEvent()
    const pointerEvent = new PointerEvent('pointerdown', { clientX: 100, clientY: 650, pointerId: 1 })

    onGrab(event, pointerEvent)
    track.listeners.get('pointerup')!(new PointerEvent('pointerup'))

    expect(onMoved).not.toHaveBeenCalled()
  })

  // === Resize тесты ===

  describe('resize mode', () => {
    let onResized: ReturnType<typeof vi.fn>

    beforeEach(() => {
      onResized = vi.fn().mockResolvedValue(undefined)
    })

    function setupWithResize() {
      const trackEl = ref<HTMLElement | null>(track.el)
      return usePointerDnd({
        trackEl,
        dayOffset: () => 0,
        dateFromX: () => new Date('2026-04-10'),
        dayWidth: 150,
        onMoved,
        onClicked,
        onResized,
      })
    }

    // Позитивные

    it('onResizeStart ставит dragMode = resize и показывает overlay при pointermove', () => {
      const { onResizeStart, dragMode, showOverlay } = setupWithResize()
      const event = makeEvent({ startMinutes: 600, durationMinutes: 60 })
      const pe = new PointerEvent('pointerdown', { clientX: 100, clientY: 660, pointerId: 1 })

      onResizeStart(event, pe)
      expect(dragMode.value).toBe('resize')

      // pointermove triggers overlay
      track.listeners.get('pointermove')!(new PointerEvent('pointermove', { clientX: 100, clientY: 680 }))
      expect(showOverlay.value).toBe(true)
    })

    it('resize snap к 5-мин сетке', () => {
      const { onResizeStart, overlayHeight } = setupWithResize()
      const event = makeEvent({ startMinutes: 600, durationMinutes: 60 })
      const pe = new PointerEvent('pointerdown', { clientX: 100, clientY: 660, pointerId: 1 })

      onResizeStart(event, pe)
      // Move pointer to Y=647 → bottom at 647, duration = 647 - 600 = 47 → snap to 45
      track.listeners.get('pointermove')!(new PointerEvent('pointermove', { clientX: 100, clientY: 647 }))
      expect(overlayHeight.value % 5).toBe(0)
    })

    it('onResized вызывается с правильным durationMinutes при pointerup', async () => {
      const { onResizeStart } = setupWithResize()
      const event = makeEvent({ startMinutes: 600, durationMinutes: 60 })
      const pe = new PointerEvent('pointerdown', { clientX: 100, clientY: 660, pointerId: 1 })

      onResizeStart(event, pe)
      // Move to extend to 90 min: pointer at Y=690
      track.listeners.get('pointermove')!(new PointerEvent('pointermove', { clientX: 100, clientY: 690 }))
      await track.listeners.get('pointerup')!(new PointerEvent('pointerup'))

      expect(onResized).toHaveBeenCalledOnce()
      expect(onResized.mock.calls[0]![0]).toBe('1')
      expect(onResized.mock.calls[0]![1]).toBe(90)
    })

    it('overlayTimeLabel в режиме resize показывает корректное время', () => {
      const { onResizeStart, overlayTimeLabel } = setupWithResize()
      const event = makeEvent({ startMinutes: 600, durationMinutes: 60 })
      const pe = new PointerEvent('pointerdown', { clientX: 100, clientY: 660, pointerId: 1 })

      onResizeStart(event, pe)
      // Move to 90 min duration
      track.listeners.get('pointermove')!(new PointerEvent('pointermove', { clientX: 100, clientY: 690 }))
      // 600 min = 10:00, 600+90 = 690 min = 11:30
      expect(overlayTimeLabel.value).toBe('10:00–11:30')
    })

    // Негативные

    it('resize enforces minimum 15 минут', () => {
      const { onResizeStart, overlayHeight } = setupWithResize()
      const event = makeEvent({ startMinutes: 600, durationMinutes: 60 })
      const pe = new PointerEvent('pointerdown', { clientX: 100, clientY: 660, pointerId: 1 })

      onResizeStart(event, pe)
      // Move pointer to Y=605 → duration = 605 - 600 = 5 → clamped to 15
      track.listeners.get('pointermove')!(new PointerEvent('pointermove', { clientX: 100, clientY: 605 }))
      expect(overlayHeight.value).toBe(15)
    })

    it('onResized НЕ вызывается если длительность не изменилась', async () => {
      const { onResizeStart } = setupWithResize()
      const event = makeEvent({ startMinutes: 600, durationMinutes: 60 })
      const pe = new PointerEvent('pointerdown', { clientX: 100, clientY: 660, pointerId: 1 })

      onResizeStart(event, pe)
      // No pointermove — duration stays 60
      await track.listeners.get('pointerup')!(new PointerEvent('pointerup'))

      expect(onResized).not.toHaveBeenCalled()
    })

    it('onMoved НЕ вызывается в resize режиме', async () => {
      const { onResizeStart } = setupWithResize()
      const event = makeEvent({ startMinutes: 600, durationMinutes: 60 })
      const pe = new PointerEvent('pointerdown', { clientX: 100, clientY: 660, pointerId: 1 })

      onResizeStart(event, pe)
      track.listeners.get('pointermove')!(new PointerEvent('pointermove', { clientX: 100, clientY: 690 }))
      await track.listeners.get('pointerup')!(new PointerEvent('pointerup'))

      expect(onMoved).not.toHaveBeenCalled()
    })
  })
})
