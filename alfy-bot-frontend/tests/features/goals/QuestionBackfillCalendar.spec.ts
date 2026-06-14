import type { QuestionTypeOption } from '@/api/question-types'
import type { FillStatusEntry } from '@/api/reports'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchFillStatus, submitAnswer } from '@/api/reports'
import QuestionBackfillCalendar from '@/features/goals/ui/QuestionBackfillCalendar.vue'
import { useQuestionTypesStore } from '@/stores/question-types-store'

vi.mock('@/api/reports', () => ({
  fetchFillStatus: vi.fn(),
  submitAnswer: vi.fn(),
  submitPhotoAnswer: vi.fn(),
}))

const SERVER_TYPES: QuestionTypeOption[] = [
  { type: 'text', label: 'Текстовый ввод', example: 'Что сделал?' },
  { type: 'yes_no', label: 'Да/Нет', example: 'Выполнил?', options: ['Да', 'Нет'] },
]

// status за июнь 2026: 06-11 заполнено, остальные due-дни пусты. today=2026-06-14.
function juneStatus(): FillStatusEntry[] {
  return [
    { date: '2026-06-10', filled: false },
    { date: '2026-06-11', filled: true },
    { date: '2026-06-12', filled: false },
    { date: '2026-06-13', filled: false },
    { date: '2026-06-14', filled: false },
  ]
}

beforeAll(() => {
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:mock',
    revokeObjectURL: () => {},
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  // Фиксируем только Date (не таймеры/rAF), чтобы today() был детерминирован,
  // а reka-ui календарь работал штатно.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-14T12:00:00'))
  setActivePinia(createPinia())
  const store = useQuestionTypesStore()
  store.types = SERVER_TYPES
  store.loaded = true
})

afterEach(() => {
  vi.useRealTimers()
})

function mountCal(type: QuestionTypeOption['type'] = 'yes_no') {
  return mount(QuestionBackfillCalendar, { props: { questionId: 42, type } })
}

describe('questionBackfillCalendar', () => {
  it('грузит статус и показывает активную кнопку «Заполнить за сегодня»', async () => {
    vi.mocked(fetchFillStatus).mockResolvedValue(juneStatus())

    const wrapper = mountCal()
    await flushPromises()

    expect(fetchFillStatus).toHaveBeenCalledWith(42)
    const btn = wrapper.get('[data-testid="backfill-today"]')
    expect(btn.text()).toContain('Заполнить за сегодня')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('кнопка сегодня заблокирована и помечена, когда сегодня уже заполнено', async () => {
    const status = juneStatus().map(s =>
      s.date === '2026-06-14' ? { ...s, filled: true } : s,
    )
    vi.mocked(fetchFillStatus).mockResolvedValue(status)

    const wrapper = mountCal()
    await flushPromises()

    const btn = wrapper.get('[data-testid="backfill-today"]')
    expect(btn.text()).toContain('Сегодня уже заполнено')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('пустой статус → «Нет дней для заполнения»', async () => {
    vi.mocked(fetchFillStatus).mockResolvedValue([])

    const wrapper = mountCal()
    await flushPromises()

    expect(wrapper.text()).toContain('Нет дней для заполнения')
    expect(wrapper.find('[data-testid="backfill-today"]').exists()).toBe(false)
  })

  it('клик «Заполнить за сегодня» открывает ввод; submit шлёт дату сегодня и эмитит filled', async () => {
    vi.mocked(fetchFillStatus).mockResolvedValue(juneStatus())
    vi.mocked(submitAnswer).mockResolvedValue(undefined)

    const wrapper = mountCal()
    await flushPromises()

    await wrapper.get('[data-testid="backfill-today"]').trigger('click')
    await flushPromises()

    // панель ввода появилась
    expect(wrapper.find('[data-testid="backfill-input-panel"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Сегодня')

    await wrapper.get('[data-testid="yesno-yes"]').trigger('click')
    await flushPromises()

    expect(submitAnswer).toHaveBeenCalledWith(42, '2026-06-14', 'yes')
    expect(wrapper.emitted('filled')).toBeTruthy()
    // панель закрылась после успеха
    expect(wrapper.find('[data-testid="backfill-input-panel"]').exists()).toBe(false)
  })

  it('ошибка submit оставляет панель и показывает ошибку (fail-fast)', async () => {
    vi.mocked(fetchFillStatus).mockResolvedValue(juneStatus())
    vi.mocked(submitAnswer).mockRejectedValue(new Error('network'))

    const wrapper = mountCal()
    await flushPromises()

    await wrapper.get('[data-testid="backfill-today"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="yesno-yes"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="backfill-input-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="backfill-error"]').exists()).toBe(true)
    expect(wrapper.emitted('filled')).toBeFalsy()
  })

  it('клик по незаполненному дню календаря открывает панель за этот день', async () => {
    vi.mocked(fetchFillStatus).mockResolvedValue(juneStatus())

    const wrapper = mountCal()
    await flushPromises()

    // находим ячейку с числом 12 (June 12, unfilled) и кликаем
    const cell = wrapper.findAll('button').find(b => b.text().trim() === '12')
    expect(cell).toBeTruthy()
    await cell!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="backfill-input-panel"]').exists()).toBe(true)
  })
})
