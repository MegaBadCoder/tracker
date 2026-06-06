import type { QuestionTypeOption } from '@/api/question-types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import YesNoAnswerInput from '@/features/goals/ui/answer-inputs/YesNoAnswerInput.vue'
import { useQuestionTypesStore } from '@/stores/question-types-store'

const SERVER_TYPES: QuestionTypeOption[] = [
  { type: 'yes_no', label: 'Да/Нет', example: 'Выполнил запланированное?', options: ['Да', 'Нет'] },
]

function seedStore() {
  const store = useQuestionTypesStore()
  store.types = SERVER_TYPES
  store.loaded = true
}

describe('yes-no answer input', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('рендерит лейблы «Да»/«Нет» из стора', () => {
    seedStore()
    const wrapper = mount(YesNoAnswerInput)

    expect(wrapper.find('[data-testid="yesno-yes"]').text()).toBe('Да')
    expect(wrapper.find('[data-testid="yesno-no"]').text()).toBe('Нет')
  })

  it('до гидрации показывает дефолтные лейблы и не крашится', () => {
    const wrapper = mount(YesNoAnswerInput)

    expect(wrapper.find('[data-testid="yesno-yes"]').text()).toBe('Да')
    expect(wrapper.find('[data-testid="yesno-no"]').text()).toBe('Нет')
  })

  it('«Да» эмитит submit со строкой "yes"', async () => {
    seedStore()
    const wrapper = mount(YesNoAnswerInput)

    await wrapper.find('[data-testid="yesno-yes"]').trigger('click')

    const events = wrapper.emitted('submit')
    expect(events).toBeTruthy()
    expect(events![0][0]).toBe('yes')
  })

  it('«Нет» эмитит submit со строкой "no"', async () => {
    seedStore()
    const wrapper = mount(YesNoAnswerInput)

    await wrapper.find('[data-testid="yesno-no"]').trigger('click')

    const events = wrapper.emitted('submit')
    expect(events).toBeTruthy()
    expect(events![0][0]).toBe('no')
  })
})
