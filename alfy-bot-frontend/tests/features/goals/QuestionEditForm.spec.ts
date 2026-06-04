import type { QuestionWithScheduleItem } from '@/api/goals'
import type { QuestionTypeOption } from '@/api/question-types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import QuestionEditForm from '@/features/goals/ui/QuestionEditForm.vue'
import { useQuestionTypesStore } from '@/stores/question-types-store'

const SERVER_TYPES: QuestionTypeOption[] = [
  { type: 'text', label: 'Текстовый ввод', example: 'Что сделал сегодня?' },
  { type: 'number', label: 'Число', example: 'Сколько страниц написал?' },
]

function seedStore() {
  const store = useQuestionTypesStore()
  store.types = SERVER_TYPES
  store.loaded = true
}

function makeInitial(overrides: Partial<QuestionWithScheduleItem> = {}): QuestionWithScheduleItem {
  return {
    type: 'number',
    question: 'Сколько страниц?',
    targetValue: '50',
    canSkip: false,
    scheduleType: 'daily',
    ...overrides,
  }
}

describe('QuestionEditForm — smoke', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    seedStore()
  })

  it('рендерит target_value input для type=number с переданным значением', () => {
    const wrapper = mount(QuestionEditForm, {
      props: { initial: makeInitial() },
    })

    const target = wrapper.find('[data-testid="target-value"]')
    expect(target.exists()).toBe(true)
    expect((target.element as HTMLInputElement).value).toBe('50')
  })

  it('скрывает target_value при смене type на text', async () => {
    const wrapper = mount(QuestionEditForm, {
      props: { initial: makeInitial() },
    })

    expect(wrapper.find('[data-testid="target-value"]').exists()).toBe(true)

    await wrapper.find('[data-testid="type-text"]').trigger('click')

    expect(wrapper.find('[data-testid="target-value"]').exists()).toBe(false)
  })

  it('при Save emit "save" с очищенным payload (без targetValue при type=text)', async () => {
    const wrapper = mount(QuestionEditForm, {
      props: { initial: makeInitial() },
    })

    await wrapper.find('[data-testid="type-text"]').trigger('click')
    await wrapper.find('[data-testid="save"]').trigger('click')

    const events = wrapper.emitted('save')
    expect(events).toBeTruthy()
    expect(events).toHaveLength(1)
    const payload = events![0][0] as QuestionWithScheduleItem
    expect(payload.type).toBe('text')
    expect(payload.question).toBe('Сколько страниц?')
    expect(payload.canSkip).toBe(false)
    expect(payload.scheduleType).toBe('daily')
    expect(payload).not.toHaveProperty('targetValue')
    expect(payload).not.toHaveProperty('selectedDays')
    expect(payload).not.toHaveProperty('intervalDays')
  })

  it('Cancel — emit "cancel"', async () => {
    const wrapper = mount(QuestionEditForm, {
      props: { initial: makeInitial() },
    })

    await wrapper.find('[data-testid="cancel"]').trigger('click')

    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
