import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PriorityPickerContent from '@/features/tasks/ui/PriorityPickerContent.vue'

describe('PriorityPickerContent', () => {
  it('кнопка Убрать эмитит null, не undefined', async () => {
    const wrapper = mount(PriorityPickerContent, {
      props: { modelValue: 'high' },
    })
    const buttons = wrapper.findAll('button')
    const clear = buttons.find(b => b.text().includes('Убрать'))
    expect(clear).toBeDefined()
    await clear!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null])
  })
})
