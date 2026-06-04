import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NumberAnswerInput from '@/features/goals/ui/answer-inputs/NumberAnswerInput.vue'

// Regression: <input type="number"> emits a NUMBER via v-model, so numberAnswer
// must tolerate it. Previously numberAnswer(raw) called raw.trim() → TypeError
// swallowed in the canSubmit computed → submit button stayed disabled forever.
describe('number answer input', () => {
  it('enables submit and emits the trimmed string after a numeric value is typed', async () => {
    const wrapper = mount(NumberAnswerInput)
    const input = wrapper.find('[data-testid="number-input"]')
    await input.setValue('123132')

    const btn = wrapper.find('[data-testid="number-submit"]')
    expect(btn.attributes('disabled')).toBeUndefined()

    await btn.trigger('click')
    expect(wrapper.emitted('submit')).toEqual([['123132']])
  })

  it('keeps submit disabled while empty', () => {
    const wrapper = mount(NumberAnswerInput)
    expect(wrapper.find('[data-testid="number-submit"]').attributes('disabled')).toBeDefined()
  })
})
