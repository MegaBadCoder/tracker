import type { QuestionTypeOption } from '@/api/question-types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import EmojiRatingAnswerInput from '@/features/goals/ui/answer-inputs/EmojiRatingAnswerInput.vue'
import { useQuestionTypesStore } from '@/stores/question-types-store'

const SERVER_TYPES: QuestionTypeOption[] = [
  { type: 'emoji_rating', label: 'Оценка (смайлики)', example: 'Как прошёл день?', options: ['😕', '😐', '🙂', '😊', '🔥'] },
]

function seedStore() {
  const store = useQuestionTypesStore()
  store.types = SERVER_TYPES
  store.loaded = true
}

describe('emoji-rating answer input', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('рендерит кнопку на каждый эмодзи из стора', () => {
    seedStore()
    const wrapper = mount(EmojiRatingAnswerInput)
    // options emoji_rating = ['😕', '😐', '🙂', '😊', '🔥'] → 5 кнопок
    expect(wrapper.findAll('[data-testid^="emoji-"]')).toHaveLength(5)
  })

  it('до гидрации (пустой стор) не рендерит кнопок и не крашится', () => {
    const wrapper = mount(EmojiRatingAnswerInput)
    expect(wrapper.findAll('[data-testid^="emoji-"]')).toHaveLength(0)
  })

  it('клик по 3-й кнопке эмитит submit со строкой "3" (1-based индекс, не эмодзи)', async () => {
    seedStore()
    const wrapper = mount(EmojiRatingAnswerInput)

    await wrapper.find('[data-testid="emoji-2"]').trigger('click')

    const events = wrapper.emitted('submit')
    expect(events).toBeTruthy()
    expect(events).toHaveLength(1)
    expect(events![0][0]).toBe('3')
  })
})
