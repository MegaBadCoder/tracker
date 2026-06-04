import type { ReportQueueItem } from '@/api/reports'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchGoals } from '@/api/goals'
import { fetchReportQueue } from '@/api/reports'
import HomeView from '@/views/HomeView.vue'

vi.mock('@/api/goals', () => ({
  fetchGoals: vi.fn(),
}))

vi.mock('@/api/reports', () => ({
  fetchReportQueue: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function mountHome() {
  return mount(HomeView, {
    global: {
      stubs: {
        AppHeader: true,
        GoalCard: true,
      },
    },
  })
}

describe('homeView — кнопка заполнения отчётов', () => {
  beforeEach(() => {
    vi.mocked(fetchGoals).mockReset().mockResolvedValue([])
    vi.mocked(fetchReportQueue).mockReset()
  })

  it('показывает кнопку при непустой очереди отчётов', async () => {
    const queue: ReportQueueItem[] = [
      { goalId: 1, goalName: 'A', pendingCount: 1 },
      { goalId: 2, goalName: 'B', pendingCount: 3 },
    ]
    vi.mocked(fetchReportQueue).mockResolvedValue(queue)

    const wrapper = mountHome()
    await flushPromises()

    const btn = wrapper.find('[data-testid="fill-reports-today"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('(2)')
  })

  it('не показывает кнопку при пустой очереди', async () => {
    vi.mocked(fetchReportQueue).mockResolvedValue([])

    const wrapper = mountHome()
    await flushPromises()

    expect(wrapper.find('[data-testid="fill-reports-today"]').exists()).toBe(false)
  })

  it('фейл очереди не ломает экран и скрывает кнопку', async () => {
    vi.mocked(fetchReportQueue).mockRejectedValue(new Error('boom'))

    const wrapper = mountHome()
    await flushPromises()

    expect(wrapper.find('[data-testid="fill-reports-today"]').exists()).toBe(false)
    // список целей по-прежнему отрисовался (нет ошибки экрана)
    expect(wrapper.text()).not.toContain('Не удалось загрузить цели')
  })
})
