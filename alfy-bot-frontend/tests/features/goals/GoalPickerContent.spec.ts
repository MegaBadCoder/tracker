import type { Goal } from '@/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GoalPickerContent from '@/features/goals/ui/GoalPickerContent.vue'

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 1,
    goal_name: 'Тестовая цель',
    goal_start: null,
    goal_end: null,
    status: 'active',
    createdAt: '2025-01-01',
    is_global: false,
    parent_goal_id: null,
    questions: [],
    ...overrides,
  }
}

const goals: Goal[] = [
  makeGoal({ id: 1, goal_name: 'Здоровье', is_global: true }),
  makeGoal({ id: 2, goal_name: 'Бег', parent_goal_id: 1 }),
  makeGoal({ id: 3, goal_name: 'Карьера' }),
]

describe('GoalPickerContent', () => {
  it('фильтрует по имени и показывает родителя как подпись', async () => {
    const wrapper = mount(GoalPickerContent, {
      props: { modelValue: [], goals, loading: false },
    })

    await wrapper.find('input').setValue('бег')

    expect(wrapper.text()).toContain('Бег')
    expect(wrapper.text()).toContain('Здоровье')
    expect(wrapper.text()).not.toContain('Карьера')
  })

  it('пустой поиск: подсказка, без списка', async () => {
    const wrapper = mount(GoalPickerContent, {
      props: { modelValue: [], goals, loading: false },
    })

    await wrapper.find('input').setValue('zzzz')

    expect(wrapper.text()).toContain('Ничего не нашлось')
    expect(wrapper.text()).toContain('Попробуйте другое название')
    expect(wrapper.text()).not.toContain('Карьера')
  })

  it('Enter выбирает первую найденную', async () => {
    const wrapper = mount(GoalPickerContent, {
      props: { modelValue: [], goals, loading: false },
    })

    await wrapper.find('input').setValue('карьер')
    await wrapper.find('input').trigger('keydown.enter')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([[3]])
  })

  it('выбранные цели на вкладке, а не секцией в списке', () => {
    const wrapper = mount(GoalPickerContent, {
      props: { modelValue: [3], goals, loading: false },
    })

    expect(wrapper.get('[data-testid="goal-picker-tab-selected"]').text()).toContain('1')
    expect(wrapper.findAll('p').map(p => p.text())).not.toContain('Выбрано')
  })
})
