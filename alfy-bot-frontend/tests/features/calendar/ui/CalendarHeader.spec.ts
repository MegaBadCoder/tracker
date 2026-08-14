import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CalendarHeader from '@/features/calendar/ui/CalendarHeader.vue'

describe('calendarHeader', () => {
  it('рендерит табы Неделя и День', () => {
    const wrapper = mount(CalendarHeader, {
      props: { label: '10–16 марта 2026', viewMode: 'week' },
    })
    const tabs = wrapper.findAll('[aria-label="Неделя"], [aria-label="День"]')
    expect(tabs).toHaveLength(2)
  })

  it('подсвечивает активный вид', () => {
    const wrapper = mount(CalendarHeader, {
      props: { label: '14 марта 2026', viewMode: 'day' },
    })
    expect(wrapper.get('[aria-label="День"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[aria-label="Неделя"]').attributes('aria-pressed')).toBe('false')
  })

  it('эмитит update:viewMode при клике на День', async () => {
    const wrapper = mount(CalendarHeader, {
      props: { label: '10–16 марта 2026', viewMode: 'week' },
    })
    await wrapper.get('[aria-label="День"]').trigger('click')
    expect(wrapper.emitted('update:viewMode')?.[0]).toEqual(['day'])
  })

  it('не эмитит при клике на уже активный таб', async () => {
    const wrapper = mount(CalendarHeader, {
      props: { label: '10–16 марта 2026', viewMode: 'week' },
    })
    await wrapper.get('[aria-label="Неделя"]').trigger('click')
    expect(wrapper.emitted('update:viewMode')).toBeUndefined()
  })
})
