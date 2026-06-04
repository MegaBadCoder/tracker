import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import YesNoAnswerInput from '@/features/goals/ui/answer-inputs/YesNoAnswerInput.vue'

describe('yes-no answer input', () => {
  it('«Да» эмитит submit со строкой "yes"', async () => {
    const wrapper = mount(YesNoAnswerInput)

    await wrapper.find('[data-testid="yesno-yes"]').trigger('click')

    const events = wrapper.emitted('submit')
    expect(events).toBeTruthy()
    expect(events![0][0]).toBe('yes')
  })

  it('«Нет» эмитит submit со строкой "no"', async () => {
    const wrapper = mount(YesNoAnswerInput)

    await wrapper.find('[data-testid="yesno-no"]').trigger('click')

    const events = wrapper.emitted('submit')
    expect(events).toBeTruthy()
    expect(events![0][0]).toBe('no')
  })
})
