import type { Goal } from '@/types'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addGoalQuestions, fetchGoalById } from '@/api/goals'
import { fetchGoalReportStatus } from '@/api/reports'
import GoalView from '@/views/GoalView.vue'

vi.mock('@/api/goals', () => ({
  fetchGoalById: vi.fn(),
  addGoalQuestions: vi.fn(),
  deleteQuestion: vi.fn(),
  updateGoal: vi.fn(),
  updateQuestion: vi.fn(),
  updateQuestionSchedule: vi.fn(),
  fetchQuestionAnswerCount: vi.fn(),
}))

vi.mock('@/api/reports', () => ({
  fetchGoalReportStatus: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '5' } }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

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
