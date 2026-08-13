import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CalendarEventBlock from '@/features/calendar/ui/CalendarEventBlock.vue'
import type { CalendarEvent } from '@/features/calendar/model/types'
import type { Task } from '@/features/tasks/model/types'
import { highlightedTaskId } from '@/features/tasks/lib/use-recurring-reschedule'

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: '1',
  title: 'Test task',
  completed: false,
  pomodoroCompleted: 0,
  ...overrides,
})

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  taskId: '1',
  title: 'Test task',
  date: new Date('2026-04-10T10:00:00'),
  startMinutes: 600,
  durationMinutes: 60,
  isAllDay: false,
  task: makeTask(),
  completed: false,
  ...overrides,
})

describe('CalendarEventBlock', () => {
  // Позитивные

  it('завершённая задача рендерится БЕЗ opacity-60', () => {
    const wrapper = mount(CalendarEventBlock, {
      props: { event: makeEvent({ completed: true }) },
    })
    expect(wrapper.classes()).not.toContain('opacity-60')
  })

  it('виртуальная задача рендерится БЕЗ opacity-40', () => {
    const wrapper = mount(CalendarEventBlock, {
      props: { event: makeEvent({ isVirtual: true }) },
    })
    expect(wrapper.classes()).not.toContain('opacity-40')
  })

  it('обычная задача рендерится с priority-классами', () => {
    const wrapper = mount(CalendarEventBlock, {
      props: { event: makeEvent({ priority: 'high' }) },
    })
    // high-priority стили адаптивны к теме: светлый базовый класс + dark-вариант
    expect(wrapper.classes()).toContain('bg-red-100')
    expect(wrapper.classes()).toContain('dark:bg-red-500/25')
  })

  // Негативные

  it('виртуальная задача не эмитит grab при pointerdown', async () => {
    const wrapper = mount(CalendarEventBlock, {
      props: { event: makeEvent({ isVirtual: true }) },
    })
    await wrapper.trigger('pointerdown', { button: 0 })
    expect(wrapper.emitted('grab')).toBeUndefined()
  })

  it('кнопка CalendarPlus только на virtual, click эмитит materialize', async () => {
    const virtual = mount(CalendarEventBlock, {
      props: { event: makeEvent({ isVirtual: true }) },
    })
    const btn = virtual.find('[data-testid="materialize-occurrence"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(virtual.emitted('materialize')).toHaveLength(1)

    const real = mount(CalendarEventBlock, {
      props: { event: makeEvent({ isVirtual: false }) },
    })
    expect(real.find('[data-testid="materialize-occurrence"]').exists()).toBe(false)
  })

  // === Resize handle тесты ===

  // Позитивные

  it('resize handle рендерится когда event.resizable = true', () => {
    const wrapper = mount(CalendarEventBlock, {
      props: { event: makeEvent({ resizable: true }) },
    })
    expect(wrapper.find('[data-testid="resize-handle"]').exists()).toBe(true)
  })

  it('resize-start эмитится при pointerdown на handle', async () => {
    const wrapper = mount(CalendarEventBlock, {
      props: { event: makeEvent({ resizable: true }) },
    })
    const handle = wrapper.find('[data-testid="resize-handle"]')
    await handle.trigger('pointerdown', { button: 0 })
    expect(wrapper.emitted('resize-start')).toBeDefined()
  })

  // Негативные

  it('resize handle НЕ рендерится когда event.resizable = false (pomodoro)', () => {
    const wrapper = mount(CalendarEventBlock, {
      props: { event: makeEvent({ resizable: false, task: makeTask({ isPomodoroTask: true }) }) },
    })
    expect(wrapper.find('[data-testid="resize-handle"]').exists()).toBe(false)
  })

  it('resize handle НЕ рендерится когда event.resizable = false (virtual)', () => {
    const wrapper = mount(CalendarEventBlock, {
      props: { event: makeEvent({ resizable: false, isVirtual: true }) },
    })
    expect(wrapper.find('[data-testid="resize-handle"]').exists()).toBe(false)
  })

  // === Pomodoro label тесты ===

  it('pomodoro label отображается когда event.pomodoroLabel задан', () => {
    const wrapper = mount(CalendarEventBlock, {
      props: { event: makeEvent({ pomodoroLabel: '4x25 мин', resizable: false }) },
    })
    expect(wrapper.text()).toContain('4x25 мин')
  })

  it('pomodoro label НЕ отображается когда event.pomodoroLabel не задан', () => {
    const wrapper = mount(CalendarEventBlock, {
      props: { event: makeEvent({ resizable: true }) },
    })
    expect(wrapper.text()).not.toContain('мин')
  })

  it('пересекающаяся колонка задаёт left/width, не на всю ширину', () => {
    const wrapper = mount(CalendarEventBlock, {
      props: { event: makeEvent(), layout: { col: 1, cols: 2 } },
    })
    const style = wrapper.attributes('style') ?? ''
    expect(style).toContain('left: calc(50% + 2px)')
    expect(style).toContain('width: calc(50% - 4px)')
  })

  it('подсвечивает блок когда highlightedTaskId совпадает', () => {
    highlightedTaskId.value = '1'
    const wrapper = mount(CalendarEventBlock, {
      props: { event: makeEvent() },
    })
    expect(wrapper.classes()).toContain('ring-primary')
  })

  afterEach(() => {
    highlightedTaskId.value = null
  })
})
