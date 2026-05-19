import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import GoalCreateView from '@/views/GoalCreateView.vue'

vi.mock('@/api/goals', () => ({
  createGoal: vi.fn(),
  addGoalQuestions: vi.fn(),
  updateGoal: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

describe('GoalCreateView', () => {
  it('рендерит начальный шаг с кнопкой "Простая цель"', () => {
    const wrapper = mount(GoalCreateView, {
      global: {
        stubs: {
          AppHeader: true,
          'router-link': true,
        },
      },
    })

    expect(wrapper.text()).toContain('Простая цель')
  })
})
