import type { GoalReportStatus, QuestionReportItem } from '@/api/reports'
import { flushPromises, mount } from '@vue/test-utils'

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchGoalReportStatus,

  submitAnswer,
  submitPhotoAnswer,
} from '@/api/reports'
import GoalReportForm from '@/features/goals/ui/GoalReportForm.vue'

vi.mock('@/api/reports', () => ({
  fetchGoalReportStatus: vi.fn(),
  submitAnswer: vi.fn(),
  submitPhotoAnswer: vi.fn(),
}))

beforeAll(() => {
  // happy-dom может не иметь URL.createObjectURL — мокаем для превью фото
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:mock',
    revokeObjectURL: () => {},
  })
})

function makeQuestion(over: Partial<QuestionReportItem>): QuestionReportItem {
  return {
    questionId: 1,
    question: 'Вопрос',
    type: 'yes_no',
    can_skip: false,
    target_value: null,
    answered: false,
    answer_text: null,
    answer_number: null,
    answer_bool: null,
    ...over,
  }
}

function makeStatus(over: Partial<GoalReportStatus>): GoalReportStatus {
  return {
    goalId: 7,
    date: '2026-06-04',
    lastUnfilledDate: null,
    questions: [],
    allDone: false,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('goalReportForm', () => {
  it('рендерит текст первого неотвеченного вопроса', async () => {
    vi.mocked(fetchGoalReportStatus).mockResolvedValue(
      makeStatus({
        questions: [
          makeQuestion({ questionId: 10, question: 'Уже отвечен', answered: true }),
          makeQuestion({ questionId: 11, question: 'Текущий вопрос', type: 'yes_no' }),
          makeQuestion({ questionId: 12, question: 'Будущий вопрос', type: 'text' }),
        ],
      }),
    )

    const wrapper = mount(GoalReportForm, { props: { goalId: 7, date: '2026-06-04' } })
    await flushPromises()

    expect(fetchGoalReportStatus).toHaveBeenCalledWith(7, '2026-06-04')
    expect(wrapper.text()).toContain('Текущий вопрос')
    expect(wrapper.text()).not.toContain('Будущий вопрос')
  })

  it('ответ yes_no «Да» шлёт submitAnswer с answer "yes"', async () => {
    vi.mocked(fetchGoalReportStatus).mockResolvedValue(
      makeStatus({
        questions: [
          makeQuestion({ questionId: 11, question: 'Текущий', type: 'yes_no' }),
          makeQuestion({ questionId: 12, question: 'Следующий', type: 'text' }),
        ],
      }),
    )
    vi.mocked(submitAnswer).mockResolvedValue(undefined)

    const wrapper = mount(GoalReportForm, { props: { goalId: 7, date: '2026-06-04' } })
    await flushPromises()

    await wrapper.find('[data-testid="yesno-yes"]').trigger('click')
    await flushPromises()

    expect(submitAnswer).toHaveBeenCalledWith(11, '2026-06-04', 'yes')
  })

  it('после ответа продвигается к следующему вопросу', async () => {
    vi.mocked(fetchGoalReportStatus).mockResolvedValue(
      makeStatus({
        questions: [
          makeQuestion({ questionId: 11, question: 'Первый', type: 'yes_no' }),
          makeQuestion({ questionId: 12, question: 'Второй', type: 'yes_no' }),
        ],
      }),
    )
    vi.mocked(submitAnswer).mockResolvedValue(undefined)

    const wrapper = mount(GoalReportForm, { props: { goalId: 7, date: '2026-06-04' } })
    await flushPromises()

    expect(wrapper.text()).toContain('Первый')
    await wrapper.find('[data-testid="yesno-yes"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Второй')
    expect(wrapper.text()).not.toContain('Первый')
  })

  it('photo-вопрос: выбор файла шлёт submitPhotoAnswer', async () => {
    vi.mocked(fetchGoalReportStatus).mockResolvedValue(
      makeStatus({
        questions: [makeQuestion({ questionId: 20, question: 'Фото', type: 'photo' })],
      }),
    )
    vi.mocked(submitPhotoAnswer).mockResolvedValue(undefined)

    const wrapper = mount(GoalReportForm, { props: { goalId: 7, date: '2026-06-04' } })
    await flushPromises()

    const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await wrapper.find('[data-testid="photo-upload"]').trigger('click')
    await flushPromises()

    expect(submitPhotoAnswer).toHaveBeenCalledTimes(1)
    expect(vi.mocked(submitPhotoAnswer).mock.calls[0][0]).toBe(20)
    expect(vi.mocked(submitPhotoAnswer).mock.calls[0][1]).toBe('2026-06-04')
    expect(vi.mocked(submitPhotoAnswer).mock.calls[0][2]).toBeInstanceOf(File)
  })

  it('после ответа на последний неотвеченный эмитит done', async () => {
    vi.mocked(fetchGoalReportStatus).mockResolvedValue(
      makeStatus({
        questions: [makeQuestion({ questionId: 11, question: 'Единственный', type: 'yes_no' })],
      }),
    )
    vi.mocked(submitAnswer).mockResolvedValue(undefined)

    const wrapper = mount(GoalReportForm, { props: { goalId: 7, date: '2026-06-04' } })
    await flushPromises()

    await wrapper.find('[data-testid="yesno-yes"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('done')).toBeTruthy()
  })

  it('сразу эмитит done, если все вопросы отвечены', async () => {
    vi.mocked(fetchGoalReportStatus).mockResolvedValue(
      makeStatus({
        allDone: true,
        questions: [makeQuestion({ questionId: 11, question: 'X', answered: true })],
      }),
    )

    const wrapper = mount(GoalReportForm, { props: { goalId: 7, date: '2026-06-04' } })
    await flushPromises()

    expect(wrapper.emitted('done')).toBeTruthy()
  })

  it('ошибка POST не продвигает и показывает сообщение', async () => {
    vi.mocked(fetchGoalReportStatus).mockResolvedValue(
      makeStatus({
        questions: [
          makeQuestion({ questionId: 11, question: 'Первый', type: 'yes_no' }),
          makeQuestion({ questionId: 12, question: 'Второй', type: 'yes_no' }),
        ],
      }),
    )
    vi.mocked(submitAnswer).mockRejectedValue(new Error('boom'))

    const wrapper = mount(GoalReportForm, { props: { goalId: 7, date: '2026-06-04' } })
    await flushPromises()

    await wrapper.find('[data-testid="yesno-yes"]').trigger('click')
    await flushPromises()

    // остаёмся на первом вопросе
    expect(wrapper.text()).toContain('Первый')
    expect(wrapper.text()).not.toContain('Второй')
    // ошибка показана
    expect(wrapper.find('[data-testid="report-error"]').exists()).toBe(true)
  })

  it('ошибка загрузки статуса показывает error, а не пустой статус', async () => {
    vi.mocked(fetchGoalReportStatus).mockRejectedValue(new Error('500'))

    const wrapper = mount(GoalReportForm, { props: { goalId: 7, date: '2026-06-04' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="report-error"]').exists()).toBe(true)
    expect(wrapper.emitted('done')).toBeFalsy()
  })

  it('can_skip: «Пропустить» переходит к следующему без записи', async () => {
    vi.mocked(fetchGoalReportStatus).mockResolvedValue(
      makeStatus({
        questions: [
          makeQuestion({ questionId: 11, question: 'Первый', type: 'yes_no', can_skip: true }),
          makeQuestion({ questionId: 12, question: 'Второй', type: 'yes_no' }),
        ],
      }),
    )

    const wrapper = mount(GoalReportForm, { props: { goalId: 7, date: '2026-06-04' } })
    await flushPromises()

    await wrapper.find('[data-testid="report-skip"]').trigger('click')
    await flushPromises()

    expect(submitAnswer).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Второй')
  })

  it('перезагружает статус при смене date', async () => {
    vi.mocked(fetchGoalReportStatus).mockResolvedValue(
      makeStatus({
        questions: [makeQuestion({ questionId: 11, question: 'Q', type: 'yes_no' })],
      }),
    )

    const wrapper = mount(GoalReportForm, { props: { goalId: 7, date: '2026-06-04' } })
    await flushPromises()
    expect(fetchGoalReportStatus).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ date: '2026-06-03' })
    await flushPromises()

    expect(fetchGoalReportStatus).toHaveBeenCalledTimes(2)
    expect(fetchGoalReportStatus).toHaveBeenLastCalledWith(7, '2026-06-03')
  })
})
