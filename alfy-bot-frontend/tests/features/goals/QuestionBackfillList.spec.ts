import type { QuestionTypeOption } from '@/api/question-types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchUnfilledDates,
  submitAnswer,
} from '@/api/reports'
import QuestionBackfillList from '@/features/goals/ui/QuestionBackfillList.vue'
import { useQuestionTypesStore } from '@/stores/question-types-store'

vi.mock('@/api/reports', () => ({
  fetchUnfilledDates: vi.fn(),
  submitAnswer: vi.fn(),
  submitPhotoAnswer: vi.fn(),
}))

const SERVER_TYPES: QuestionTypeOption[] = [
  { type: 'text', label: 'Текстовый ввод', example: 'Что сделал сегодня?' },
  { type: 'yes_no', label: 'Да/Нет', example: 'Выполнил запланированное?', options: ['Да', 'Нет'] },
  { type: 'photo', label: 'Фото', example: 'Сделай фото себя сегодня' },
]

beforeAll(() => {
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:mock',
    revokeObjectURL: () => {},
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  const store = useQuestionTypesStore()
  store.types = SERVER_TYPES
  store.loaded = true
})

describe('questionBackfillList', () => {
  it('отображает заголовок «Незаполненные дни (N)» с числом дат', async () => {
    vi.mocked(fetchUnfilledDates).mockResolvedValue(['2026-06-13', '2026-06-12', '2026-06-11'])

    const wrapper = mount(QuestionBackfillList, {
      props: { questionId: 42, type: 'yes_no' },
    })
    await flushPromises()

    expect(fetchUnfilledDates).toHaveBeenCalledWith(42)
    expect(wrapper.text()).toContain('Незаполненные дни (3)')
  })

  it('пустой список → показывает «Все дни заполнены»', async () => {
    vi.mocked(fetchUnfilledDates).mockResolvedValue([])

    const wrapper = mount(QuestionBackfillList, {
      props: { questionId: 42, type: 'yes_no' },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Все дни заполнены')
    expect(wrapper.text()).not.toContain('Незаполненные дни')
  })

  it('клик по строке даты раскрывает AnswerInput', async () => {
    vi.mocked(fetchUnfilledDates).mockResolvedValue(['2026-06-13', '2026-06-12'])

    const wrapper = mount(QuestionBackfillList, {
      props: { questionId: 42, type: 'yes_no' },
    })
    await flushPromises()

    // до клика AnswerInput нет
    expect(wrapper.find('[data-testid="yesno-yes"]').exists()).toBe(false)

    // кликаем по первой строке
    await wrapper.find('[data-testid="backfill-date-row"]').trigger('click')
    await flushPromises()

    // после клика AnswerInput появился
    expect(wrapper.find('[data-testid="yesno-yes"]').exists()).toBe(true)
  })

  it('ответ на вопрос вызывает submitAnswer с правильными аргументами', async () => {
    vi.mocked(fetchUnfilledDates).mockResolvedValue(['2026-06-13', '2026-06-12'])
    vi.mocked(submitAnswer).mockResolvedValue(undefined)

    const wrapper = mount(QuestionBackfillList, {
      props: { questionId: 42, type: 'yes_no' },
    })
    await flushPromises()

    await wrapper.find('[data-testid="backfill-date-row"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="yesno-yes"]').trigger('click')
    await flushPromises()

    expect(submitAnswer).toHaveBeenCalledWith(42, '2026-06-13', 'yes')
  })

  it('успешный submit удаляет строку из списка и эмитит filled', async () => {
    vi.mocked(fetchUnfilledDates).mockResolvedValue(['2026-06-13', '2026-06-12'])
    vi.mocked(submitAnswer).mockResolvedValue(undefined)

    const wrapper = mount(QuestionBackfillList, {
      props: { questionId: 42, type: 'yes_no' },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Незаполненные дни (2)')

    await wrapper.find('[data-testid="backfill-date-row"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="yesno-yes"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Незаполненные дни (1)')
    expect(wrapper.emitted('filled')).toBeTruthy()
  })

  it('ошибка submit оставляет строку и показывает ошибку (fail-fast)', async () => {
    vi.mocked(fetchUnfilledDates).mockResolvedValue(['2026-06-13'])
    vi.mocked(submitAnswer).mockRejectedValue(new Error('network error'))

    const wrapper = mount(QuestionBackfillList, {
      props: { questionId: 42, type: 'yes_no' },
    })
    await flushPromises()

    await wrapper.find('[data-testid="backfill-date-row"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="yesno-yes"]').trigger('click')
    await flushPromises()

    // строка осталась
    expect(wrapper.text()).toContain('Незаполненные дни (1)')
    // ошибка показана
    expect(wrapper.find('[data-testid="backfill-row-error"]').exists()).toBe(true)
    // filled не эмитился
    expect(wrapper.emitted('filled')).toBeFalsy()
  })

  it('90 дат → показывает подпись «показаны последние 90»', async () => {
    const dates = Array.from({ length: 90 }, (_, i) => {
      const d = new Date('2026-06-13')
      d.setDate(d.getDate() - i)
      return d.toISOString().slice(0, 10)
    })
    vi.mocked(fetchUnfilledDates).mockResolvedValue(dates)

    const wrapper = mount(QuestionBackfillList, {
      props: { questionId: 42, type: 'yes_no' },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('показаны последние 90')
  })
})
