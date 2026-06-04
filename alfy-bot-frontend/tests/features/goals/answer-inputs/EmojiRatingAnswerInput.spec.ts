import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import EmojiRatingAnswerInput from '@/features/goals/ui/answer-inputs/EmojiRatingAnswerInput.vue'

describe('emoji-rating answer input', () => {
  it('рендерит кнопку на каждый эмодзи из options', () => {
    const wrapper = mount(EmojiRatingAnswerInput)
    // options emoji_rating = ['😕', '😐', '🙂', '😊', '🔥'] → 5 кнопок
    expect(wrapper.findAll('[data-testid^="emoji-"]')).toHaveLength(5)
  })

  it('клик по 3-й кнопке эмитит submit со строкой "3" (1-based индекс, не эмодзи)', async () => {
    const wrapper = mount(EmojiRatingAnswerInput)

    await wrapper.find('[data-testid="emoji-2"]').trigger('click')

    const events = wrapper.emitted('submit')
    expect(events).toBeTruthy()
    expect(events).toHaveLength(1)
    expect(events![0][0]).toBe('3')
  })
})
