import type { QuestionTypeOption } from '@/api/question-types'
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QuestionTypeStep from '@/features/goals/ui/steps/QuestionTypeStep.vue'
import { useQuestionTypesStore } from '@/stores/question-types-store'
import GoalCreateView from '@/views/GoalCreateView.vue'

vi.mock('@/api/goals', () => ({
  createGoal: vi.fn(),
  addGoalQuestions: vi.fn(),
  updateGoal: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

const SERVER_TYPES: QuestionTypeOption[] = [
  { type: 'text', label: 'Текстовый ввод', example: 'Что сделал сегодня?' },
  { type: 'number', label: 'Число', example: 'Сколько страниц написал?' },
]

beforeEach(() => {
  setActivePinia(createPinia())
  const store = useQuestionTypesStore()
  store.types = SERVER_TYPES
  store.loaded = true
})

describe('goalCreateView', () => {
  it('рендерит начальный шаг с кнопкой "Простая цель"', () => {
    const wrapper = mount(GoalCreateView, {
      global: {
        stubs: {
          'AppHeader': true,
          'router-link': true,
        },
      },
    })

    expect(wrapper.text()).toContain('Простая цель')
  })
})

describe('questionTypeStep — список добавленных вопросов', () => {
  function makeStateWithQuestion(): FlowState {
    return {
      step: 'q_type',
      questionsToAdd: [
        {
          question: 'Сколько страниц прочитал?',
          type: 'number',
          canSkip: false,
          scheduleType: 'daily',
          targetValue: '10',
        },
      ],
      pending: {},
    }
  }

  it('рендерит карточку добавленного вопроса с edit/delete кнопками', () => {
    const wrapper = mount(QuestionTypeStep, {
      props: { state: makeStateWithQuestion() },
    })

    expect(wrapper.text()).toContain('Сколько страниц прочитал?')
    expect(wrapper.text()).toContain('Каждый день')
    expect(wrapper.find('[data-testid="pending-question-0"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="edit-pending-0"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="delete-pending-0"]').exists()).toBe(true)
  })

  it('эмитит editPendingQuestion(idx) по клику Pencil', async () => {
    const wrapper = mount(QuestionTypeStep, {
      props: { state: makeStateWithQuestion() },
    })

    await wrapper.find('[data-testid="edit-pending-0"]').trigger('click')

    const events = wrapper.emitted('editPendingQuestion')
    expect(events).toBeTruthy()
    expect(events![0]).toEqual([0])
  })

  it('не рендерит секцию с вопросами, если questionsToAdd пуст', () => {
    const wrapper = mount(QuestionTypeStep, {
      props: {
        state: {
          step: 'q_type',
          questionsToAdd: [],
          pending: {},
        } as FlowState,
      },
    })

    expect(wrapper.find('[data-testid="pending-question-0"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Добавленные вопросы')
  })
})
