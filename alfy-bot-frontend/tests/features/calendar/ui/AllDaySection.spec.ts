import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AllDaySection from '@/features/calendar/ui/AllDaySection.vue'
import type { CalendarEvent } from '@/features/calendar/model/types'
import type { Task } from '@/features/tasks/model/types'

const today = new Date('2026-04-10T00:00:00')

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: '1',
  title: 'All day task',
  completed: false,
  pomodoroCompleted: 0,
  ...overrides,
})

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  taskId: '1',
  title: 'All day task',
  date: today,
  startMinutes: 0,
  durationMinutes: 0,
  isAllDay: true,
  task: makeTask(),
  completed: false,
  ...overrides,
})

const defaultProps = {
  visibleDays: [today],
  dayOffset: () => 0,
  dayWidth: 150,
  trackWidth: 1_000_000,
  events: [makeEvent()],
}

describe('AllDaySection', () => {
  // Позитивные

  it('завершённая all-day задача рендерится БЕЗ opacity-50', () => {
    const wrapper = mount(AllDaySection, {
      props: {
        ...defaultProps,
        events: [makeEvent({ completed: true })],
      },
    })
    const chip = wrapper.find('[draggable="true"]')
    expect(chip.exists()).toBe(true)
    expect(chip.classes()).not.toContain('opacity-50')
  })

  it('клик по event chip эмитит open с CalendarEvent', async () => {
    const event = makeEvent()
    const wrapper = mount(AllDaySection, {
      props: { ...defaultProps, events: [event] },
    })
    const chip = wrapper.find('[draggable="true"]')
    await chip.trigger('click')

    expect(wrapper.emitted('open')).toBeDefined()
    expect(wrapper.emitted('open')![0]![0]).toMatchObject({ taskId: '1' })
  })

  // Негативные

  it('dragstart по-прежнему работает', async () => {
    const wrapper = mount(AllDaySection, {
      props: defaultProps,
    })
    const chip = wrapper.find('[draggable="true"]')
    await chip.trigger('dragstart', {
      dataTransfer: { setData: () => {} },
    })

    expect(wrapper.emitted('dragstart')).toBeDefined()
  })
})
