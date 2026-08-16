import type { QuestionTypeOption } from '@/api/question-types'
import type { Goal } from '@/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addGoalQuestions, fetchGoalById } from '@/api/goals'
import { fetchGoalReportStatus } from '@/api/reports'
import { useQuestionTypesStore } from '@/stores/question-types-store'
import GoalView from '@/views/GoalView.vue'

// vue-router замокан один раз на файл. route id изменяемый — каждый describe
// выставляет нужный в своём beforeEach (глобальная/обычная цель → '1', добавление вопроса → '5').
const { routeParams, push } = vi.hoisted(() => ({
  routeParams: { id: '1' } as { id: string },
  push: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: routeParams }),
  useRouter: () => ({ push, replace: vi.fn() }),
}))

vi.mock('@/api/goals', () => ({
  fetchGoalById: vi.fn(),
  fetchGoals: vi.fn(),
  addGoalQuestions: vi.fn(),
  deleteQuestion: vi.fn(),
  fetchQuestionAnswerCount: vi.fn(),
  updateGoal: vi.fn(),
  updateQuestion: vi.fn(),
  updateQuestionSchedule: vi.fn(),
}))

vi.mock('@/api/reports', () => ({
  fetchGoalReportStatus: vi.fn(),
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
    routeParams.id = '1'
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
    routeParams.id = '1'
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

const SERVER_TYPES: QuestionTypeOption[] = [
  { type: 'text', label: 'Текстовый ввод', example: 'Что сделал сегодня?' },
  { type: 'number', label: 'Число', example: 'Сколько страниц написал?' },
]

function makeGoal(): Goal {
  return {
    id: 5,
    goal_name: 'Тест',
    goal_start: '2026-05-01',
    goal_end: '2026-12-31',
    status: 'active',
    createdAt: '2026-05-01',
    questions: [],
  }
}

function mountGoal() {
  return mount(GoalView, {
    attachTo: document.body,
    global: {
      stubs: { AppHeader: true },
    },
  })
}

describe('goalView — добавление вопроса', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    const store = useQuestionTypesStore()
    store.types = SERVER_TYPES
    store.loaded = true
    routeParams.id = '5'
    vi.mocked(fetchGoalById).mockResolvedValue(makeGoal())
    vi.mocked(fetchGoalReportStatus).mockResolvedValue({
      goalId: 5,
      date: '2026-06-04',
      lastUnfilledDate: null,
      questions: [],
      allDone: true,
    })
  })

  it('кнопка открывает Sheet, save шлёт addGoalQuestions и перезагружает цель', async () => {
    vi.mocked(addGoalQuestions).mockResolvedValue([])
    const wrapper = mountGoal()
    await flushPromises()

    await wrapper.find('[data-testid="add-question-cta"]').trigger('click')
    await flushPromises()

    // форма (в Sheet, телепортится в body)
    const input = document.body.querySelector('[data-testid="question-text"]') as HTMLInputElement
    expect(input).toBeTruthy()
    input.value = 'Сколько прошёл шагов?'
    input.dispatchEvent(new Event('input'))
    await flushPromises()

    const saveBtn = document.body.querySelector('[data-testid="save"]') as HTMLButtonElement
    saveBtn.click()
    await flushPromises()

    expect(addGoalQuestions).toHaveBeenCalledTimes(1)
    const [goalId, items] = vi.mocked(addGoalQuestions).mock.calls[0]
    expect(goalId).toBe(5)
    expect(items).toEqual([
      { question: 'Сколько прошёл шагов?', type: 'text', canSkip: false, scheduleType: 'daily' },
    ])
    // reloadGoal: fetchGoalById вызван повторно (1 на mount + 1 после save)
    expect(vi.mocked(fetchGoalById).mock.calls.length).toBeGreaterThanOrEqual(2)

    wrapper.unmount()
  })

  it('ошибка addGoalQuestions → Sheet остаётся, цель не перезагружается', async () => {
    vi.mocked(addGoalQuestions).mockRejectedValue(new Error('boom'))
    const wrapper = mountGoal()
    await flushPromises()

    await wrapper.find('[data-testid="add-question-cta"]').trigger('click')
    await flushPromises()

    const input = document.body.querySelector('[data-testid="question-text"]') as HTMLInputElement
    input.value = 'Вопрос'
    input.dispatchEvent(new Event('input'))
    await flushPromises()

    const fetchCallsBefore = vi.mocked(fetchGoalById).mock.calls.length
    ;(document.body.querySelector('[data-testid="save"]') as HTMLButtonElement).click()
    await flushPromises()

    expect(addGoalQuestions).toHaveBeenCalledTimes(1)
    // не перезагрузили цель
    expect(vi.mocked(fetchGoalById).mock.calls.length).toBe(fetchCallsBefore)
    // ошибка показана в форме, Sheet ещё в DOM
    expect(document.body.querySelector('[data-testid="api-error"]')?.textContent).toContain('boom')
    expect(document.body.querySelector('[data-testid="save"]')).toBeTruthy()

    wrapper.unmount()
  })
})

describe('goalView — завершение цели', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    const store = useQuestionTypesStore()
    store.types = SERVER_TYPES
    store.loaded = true
    routeParams.id = '5'
    vi.mocked(fetchGoalById).mockResolvedValue(makeGoal())
    vi.mocked(fetchGoalReportStatus).mockResolvedValue({
      goalId: 5,
      date: '2026-06-04',
      lastUnfilledDate: null,
      questions: [],
      allDone: true,
    })
  })

  it('Успех → PATCH status=completed, outcome=success', async () => {
    const goalsApi = await import('@/api/goals')
    vi.mocked(goalsApi.updateGoal).mockResolvedValue({
      ...makeGoal(),
      status: 'completed',
      outcome: 'success',
    })
    const wrapper = mountGoal()
    await flushPromises()

    await wrapper.find('[data-testid="goal-complete-cta"]').trigger('click')
    await flushPromises()

    const success = document.body.querySelector('[data-testid="complete-success"]') as HTMLButtonElement
    expect(success).toBeTruthy()
    success.click()
    await flushPromises()

    expect(goalsApi.updateGoal).toHaveBeenCalledWith(5, {
      status: 'completed',
      outcome: 'success',
    })
    wrapper.unmount()
  })

  it('Неудача → PATCH outcome=failure', async () => {
    const goalsApi = await import('@/api/goals')
    vi.mocked(goalsApi.updateGoal).mockResolvedValue({
      ...makeGoal(),
      status: 'completed',
      outcome: 'failure',
    })
    const wrapper = mountGoal()
    await flushPromises()

    await wrapper.find('[data-testid="goal-complete-cta"]').trigger('click')
    await flushPromises()
    ;(document.body.querySelector('[data-testid="complete-failure"]') as HTMLButtonElement).click()
    await flushPromises()

    expect(goalsApi.updateGoal).toHaveBeenCalledWith(5, {
      status: 'completed',
      outcome: 'failure',
    })
    wrapper.unmount()
  })
})
