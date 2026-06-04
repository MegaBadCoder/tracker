import type { ReportQueueItem } from '@/api/reports'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchReportQueue } from '@/api/reports'
import GoalsReportFlowView from '@/views/GoalsReportFlowView.vue'

vi.mock('@/api/reports', () => ({
  fetchReportQueue: vi.fn(),
}))

const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

// Заглушка формы: эмитит `done` по клику, отражает goalId через data-атрибут.
const GoalReportFormStub = {
  name: 'GoalReportForm',
  props: ['goalId', 'date'],
  emits: ['done'],
  template: `<button data-testid="form-stub" :data-goal-id="goalId" @click="$emit('done')">form {{ goalId }}</button>`,
}

function mountView() {
  return mount(GoalsReportFlowView, {
    global: {
      stubs: {
        AppHeader: true,
        GoalReportForm: GoalReportFormStub,
      },
    },
  })
}

function makeQueue(): ReportQueueItem[] {
  return [
    { goalId: 11, goalName: 'Чтение', pendingCount: 2 },
    { goalId: 22, goalName: 'Спорт', pendingCount: 1 },
  ]
}

describe('goalsReportFlowView', () => {
  beforeEach(() => {
    vi.mocked(fetchReportQueue).mockReset()
    pushMock.mockReset()
  })

  it('пустая очередь → показывает "всё заполнено", форма не рендерится', async () => {
    vi.mocked(fetchReportQueue).mockResolvedValue([])

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Все отчёты на сегодня заполнены')
    expect(wrapper.find('[data-testid="form-stub"]').exists()).toBe(false)
  })

  it('очередь из 2 → рендерит форму первой цели; два done → финальный экран', async () => {
    vi.mocked(fetchReportQueue).mockResolvedValue(makeQueue())

    const wrapper = mountView()
    await flushPromises()

    // первая цель
    const form1 = wrapper.find('[data-testid="form-stub"]')
    expect(form1.exists()).toBe(true)
    expect(form1.attributes('data-goal-id')).toBe('11')
    expect(wrapper.text()).toContain('Цель 1 из 2')
    expect(wrapper.text()).toContain('Чтение')

    // done по первой → переход ко второй
    await form1.trigger('click')
    await flushPromises()

    const form2 = wrapper.find('[data-testid="form-stub"]')
    expect(form2.attributes('data-goal-id')).toBe('22')
    expect(wrapper.text()).toContain('Цель 2 из 2')
    expect(wrapper.text()).toContain('Спорт')

    // done по второй → финальный экран
    await form2.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="form-stub"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Все отчёты заполнены')
  })

  it('ошибка загрузки очереди → сообщение об ошибке + форма не рендерится', async () => {
    vi.mocked(fetchReportQueue).mockRejectedValue(new Error('boom'))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="report-flow-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="form-stub"]').exists()).toBe(false)
  })
})
