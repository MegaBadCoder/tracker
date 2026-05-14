import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useCreateSlotDrag } from '@/features/calendar/lib/use-create-slot-drag'

function createMockTrack() {
  const listeners = new Map<string, (e: PointerEvent) => unknown>()
  const el = {
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 1000, height: 1440 }),
    setPointerCapture: vi.fn(),
    addEventListener: (type: string, fn: (e: PointerEvent) => unknown) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
  } as unknown as HTMLElement
  return { el, listeners }
}

function makePointerEvent(
  type: string,
  init: Partial<PointerEventInit> & { target?: HTMLElement | null } = {},
): PointerEvent {
  const { target, ...rest } = init
  const event = new PointerEvent(type, { button: 0, pointerId: 1, ...rest })
  if (target !== undefined) {
    Object.defineProperty(event, 'target', { value: target, writable: false })
  }
  return event
}

function emptyDiv(): HTMLElement {
  return document.createElement('div')
}

function eventBlockDiv(): HTMLElement {
  const div = document.createElement('div')
  div.setAttribute('data-calendar-event-block', '')
  return div
}

describe('useCreateSlotDrag', () => {
  let onCreated: ReturnType<typeof vi.fn>
  let track: ReturnType<typeof createMockTrack>

  beforeEach(() => {
    onCreated = vi.fn().mockResolvedValue(undefined)
    track = createMockTrack()
  })

  function setup() {
    const trackEl = ref<HTMLElement | null>(track.el)
    return useCreateSlotDrag({
      trackEl,
      dayOffset: () => 0,
      dateFromX: () => new Date('2026-04-10'),
      dayWidth: 150,
      onCreated,
    })
  }

  it('onCreated НЕ вызывается при pointerdown + pointerup без pointermove', async () => {
    const { onPointerDown } = setup()
    onPointerDown(makePointerEvent('pointerdown', { clientX: 100, clientY: 600, target: emptyDiv() }))

    const onUp = track.listeners.get('pointerup')
    expect(onUp).toBeDefined()
    await onUp!(makePointerEvent('pointerup'))

    expect(onCreated).not.toHaveBeenCalled()
  })

  it('onCreated вызывается с date/startMinutes/durationMinutes после drag', async () => {
    const { onPointerDown } = setup()
    onPointerDown(makePointerEvent('pointerdown', { clientX: 100, clientY: 600, target: emptyDiv() }))

    const onMove = track.listeners.get('pointermove')!
    onMove(makePointerEvent('pointermove', { clientX: 100, clientY: 660 }))

    await track.listeners.get('pointerup')!(makePointerEvent('pointerup'))

    expect(onCreated).toHaveBeenCalledOnce()
    const [date, startMinutes, durationMinutes] = onCreated.mock.calls[0]!
    expect(date).toEqual(new Date('2026-04-10'))
    expect(startMinutes).toBe(600)
    expect(durationMinutes).toBe(60)
  })

  it('overlay не показывается до движения дальше порога 3px', () => {
    const { showOverlay, onPointerDown } = setup()
    onPointerDown(makePointerEvent('pointerdown', { clientX: 100, clientY: 600, target: emptyDiv() }))

    track.listeners.get('pointermove')!(makePointerEvent('pointermove', { clientX: 101, clientY: 601 }))
    expect(showOverlay.value).toBe(false)

    track.listeners.get('pointermove')!(makePointerEvent('pointermove', { clientX: 100, clientY: 605 }))
    expect(showOverlay.value).toBe(true)
  })

  it('startMinutes и durationMinutes снаппятся к 5-минутному шагу', async () => {
    const { onPointerDown } = setup()
    onPointerDown(makePointerEvent('pointerdown', { clientX: 100, clientY: 603, target: emptyDiv() }))

    track.listeners.get('pointermove')!(makePointerEvent('pointermove', { clientX: 100, clientY: 658 }))
    await track.listeners.get('pointerup')!(makePointerEvent('pointerup'))

    const [, startMinutes, durationMinutes] = onCreated.mock.calls[0]!
    expect(startMinutes).toBe(605)
    expect(durationMinutes).toBe(55)
  })

  it('игнорирует pointerdown по существующему событию (data-calendar-event-block)', () => {
    const { onPointerDown } = setup()
    onPointerDown(makePointerEvent('pointerdown', { clientX: 100, clientY: 600, target: eventBlockDiv() }))

    expect(track.listeners.get('pointermove')).toBeUndefined()
    expect(track.listeners.get('pointerup')).toBeUndefined()
  })

  it('игнорирует pointerdown с правой кнопкой', () => {
    const { onPointerDown } = setup()
    onPointerDown(makePointerEvent('pointerdown', { button: 2, clientX: 100, clientY: 600, target: emptyDiv() }))

    expect(track.listeners.get('pointermove')).toBeUndefined()
  })

  it('игнорирует pointerdown с зажатым Ctrl (зарезервировано под grab-scroll)', () => {
    const { onPointerDown } = setup()
    onPointerDown(makePointerEvent('pointerdown', { clientX: 100, clientY: 600, ctrlKey: true, target: emptyDiv() }))

    expect(track.listeners.get('pointermove')).toBeUndefined()
  })

  it('минимальная длительность = 5 минут (шаг snap), даже если протяжка нулевая', async () => {
    const { onPointerDown } = setup()
    onPointerDown(makePointerEvent('pointerdown', { clientX: 100, clientY: 600, target: emptyDiv() }))

    track.listeners.get('pointermove')!(makePointerEvent('pointermove', { clientX: 100, clientY: 605 }))
    await track.listeners.get('pointerup')!(makePointerEvent('pointerup'))

    const [, , durationMinutes] = onCreated.mock.calls[0]!
    expect(durationMinutes).toBe(5)
  })

  it('overlay скрывается после pointercancel и onCreated не вызывается', () => {
    const { showOverlay, onPointerDown } = setup()
    onPointerDown(makePointerEvent('pointerdown', { clientX: 100, clientY: 600, target: emptyDiv() }))
    track.listeners.get('pointermove')!(makePointerEvent('pointermove', { clientX: 100, clientY: 700 }))

    expect(showOverlay.value).toBe(true)
    track.listeners.get('pointercancel')!(makePointerEvent('pointercancel'))

    expect(showOverlay.value).toBe(false)
    expect(onCreated).not.toHaveBeenCalled()
  })
})
