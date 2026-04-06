import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ViewModeToggle from '@/features/projects/ui/ViewModeToggle.vue'

describe('ViewModeToggle', () => {
  it('рендерит две кнопки', () => {
    const wrapper = mount(ViewModeToggle, {
      props: { modelValue: 'list' },
    })
    expect(wrapper.findAll('button')).toHaveLength(2)
  })

  it('подсвечивает активный режим', () => {
    const wrapper = mount(ViewModeToggle, {
      props: { modelValue: 'board' },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons[1].attributes('aria-pressed')).toBe('true')
    expect(buttons[0].attributes('aria-pressed')).toBe('false')
  })

  it('эмитит update:modelValue при клике', async () => {
    const wrapper = mount(ViewModeToggle, {
      props: { modelValue: 'list' },
    })
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['board'])
  })

  it('не эмитит при клике на уже активный', async () => {
    const wrapper = mount(ViewModeToggle, {
      props: { modelValue: 'list' },
    })
    await wrapper.findAll('button')[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
