import type { Goal } from '@/types'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GoalView from '@/views/GoalView.vue'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '1' } }),
  useRouter: () => ({ push, replace: vi.fn() }),
}))

vi.mock('@/api/goals', () => ({
  fetchGoalById: vi.fn(),
  fetchGoals: vi.fn(),
  deleteQuestion: vi.fn(),
  fetchQuestionAnswerCount: vi.fn(),
  updateGoal: vi.fn(),
  updateQuestion: vi.fn(),
  updateQuestionSchedule: vi.fn(),
}))

function makeGlobalGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 1,
    goal_name: 'Стать сильнее',
    goal_start: null,
    goal_end: null,
    status: 'active',
    createdAt: '2026-01-01',
    is_global: true,
    parent_goal_id: null,
    children: [
      {
        id: 2,
        goal_name: 'Подтянуться 20 раз',
        goal_start: '2026-01-01',
        goal_end: '2026-06-01',
        status: 'active',
        createdAt: '2026-01-01',
        is_global: false,
        parent_goal_id: 1,
        questions: [],
      },
    ],
    questions: [],
    ...overrides,
  }
}

function makeRegularGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 1,
    goal_name: 'Похудеть',
    goal_start: '2026-01-01',
    goal_end: '2026-06-01',
    status: 'active',
    createdAt: '2026-01-01',
    is_global: false,
    parent_goal_id: null,
    questions: [],
    ...overrides,
  }
}

const stubs = {
  AppHeader: true,
  GoalStatusBadge: true,
  PageContainer: { template: '<div><slot /></div>' },
  SummaryCard: true,
}

describe('goalView — global goal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    push.mockReset()
  })

  it('рендерит секцию "Цели внутри" с детьми, а не "Вопросы цели"', async () => {
    const goalsApi = await import('@/api/goals')
    vi.mocked(goalsApi.fetchGoalById).mockResolvedValue(makeGlobalGoal())

    const wrapper = mount(GoalView, { global: { stubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('Цели внутри')
    expect(wrapper.text()).not.toContain('Вопросы цели')
    expect(wrapper.find('[data-testid="child-goal-2"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Подтянуться 20 раз')
    expect(wrapper.find('[data-testid="create-child-goal"]').exists()).toBe(true)
  })

  it('переходит к ребёнку по клику', async () => {
    const goalsApi = await import('@/api/goals')
    vi.mocked(goalsApi.fetchGoalById).mockResolvedValue(makeGlobalGoal())

    const wrapper = mount(GoalView, { global: { stubs } })
    await flushPromises()

    await wrapper.find('[data-testid="child-goal-2"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'goal', params: { id: 2 } })
  })

  it('"Создать цель здесь" ведёт на создание цели', async () => {
    const goalsApi = await import('@/api/goals')
    vi.mocked(goalsApi.fetchGoalById).mockResolvedValue(makeGlobalGoal())

    const wrapper = mount(GoalView, { global: { stubs } })
    await flushPromises()

    await wrapper.find('[data-testid="create-child-goal"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'goal-create' })
  })

  it('не показывает блок дат у бессрочной global-цели', async () => {
    const goalsApi = await import('@/api/goals')
    vi.mocked(goalsApi.fetchGoalById).mockResolvedValue(makeGlobalGoal())

    const wrapper = mount(GoalView, { global: { stubs } })
    await flushPromises()

    // SummaryCard застаблен — наличие/отсутствие проверяем по компоненту
    expect(wrapper.findComponent({ name: 'SummaryCard' }).exists()).toBe(false)
  })

  it('пустой список детей — показывает подсказку', async () => {
    const goalsApi = await import('@/api/goals')
    vi.mocked(goalsApi.fetchGoalById).mockResolvedValue(makeGlobalGoal({ children: [] }))

    const wrapper = mount(GoalView, { global: { stubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('Пока нет вложенных целей')
  })
})

describe('goalView — regular goal with parent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    push.mockReset()
  })

  it('показывает ссылку на родительскую цель и переходит по ней', async () => {
    const goalsApi = await import('@/api/goals')
    vi.mocked(goalsApi.fetchGoalById).mockImplementation(async (gid: number) => {
      if (gid === 1)
        return makeRegularGoal({ parent_goal_id: 5 })
      return makeGlobalGoal({ id: 5, goal_name: 'Глобальная цель' })
    })

    const wrapper = mount(GoalView, { global: { stubs } })
    await flushPromises()

    const link = wrapper.find('[data-testid="parent-goal-link"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toContain('Глобальная цель')

    await link.trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'goal', params: { id: 5 } })
  })

  it('рендерит секцию "Вопросы цели" (не "Цели внутри")', async () => {
    const goalsApi = await import('@/api/goals')
    vi.mocked(goalsApi.fetchGoalById).mockResolvedValue(makeRegularGoal())

    const wrapper = mount(GoalView, { global: { stubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('Вопросы цели')
    expect(wrapper.text()).not.toContain('Цели внутри')
  })
})
