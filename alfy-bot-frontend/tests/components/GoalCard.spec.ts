import type { Goal } from '@/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import GoalCard from '@/components/GoalCard.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 1,
    goal_name: 'Тестовая цель',
    goal_start: '2025-01-01',
    goal_end: '2025-12-31',
    status: 'active',
    createdAt: '2025-01-01',
    is_global: false,
    parent_goal_id: null,
    questions: [],
    ...overrides,
  }
}

describe('goalCard', () => {
  it('обычная цель: показывает период дат и счётчик вопросов', () => {
    const goal = makeGoal({
      questions: [
        { id: 1 } as Goal['questions'][number],
        { id: 2 } as Goal['questions'][number],
      ],
    })
    const wrapper = mount(GoalCard, { props: { goal } })

    expect(wrapper.text()).toContain('Тестовая цель')
    expect(wrapper.text()).toContain('→')
    expect(wrapper.text()).toContain('2 вопроса')
    expect(wrapper.text()).not.toContain('Global')
  })

  it('глобальная цель с null-датами рендерится без ошибок и без периода', () => {
    const goal = makeGoal({
      is_global: true,
      goal_start: null,
      goal_end: null,
    })
    const wrapper = mount(GoalCard, { props: { goal } })

    expect(wrapper.text()).toContain('Тестовая цель')
    expect(wrapper.text()).not.toContain('→')
    expect(wrapper.text()).toContain('Global')
  })

  it('глобальная цель: показывает счётчик подцелей по children_count (из списка)', () => {
    const goal = makeGoal({
      is_global: true,
      goal_start: null,
      goal_end: null,
      children_count: 3,
    })
    const wrapper = mount(GoalCard, { props: { goal } })

    expect(wrapper.text()).toContain('3 подцели')
  })

  it('глобальная цель без подцелей: показывает «0 подцелей»', () => {
    const goal = makeGoal({
      is_global: true,
      goal_start: null,
      goal_end: null,
      children_count: 0,
    })
    const wrapper = mount(GoalCard, { props: { goal } })

    expect(wrapper.text()).toContain('0 подцелей')
  })

  it('глобальная цель с embedded children (fallback, без children_count)', () => {
    const goal = makeGoal({
      is_global: true,
      goal_start: null,
      goal_end: null,
      children: [makeGoal({ id: 2 }), makeGoal({ id: 3 })],
    })
    const wrapper = mount(GoalCard, { props: { goal } })

    expect(wrapper.text()).toContain('2 подцели')
  })
})
