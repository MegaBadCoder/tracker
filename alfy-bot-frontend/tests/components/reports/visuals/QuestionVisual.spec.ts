import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QuestionVisual from '@/components/reports/visuals/QuestionVisual.vue'
import PhotoGalleryVisual from '@/components/reports/visuals/PhotoGalleryVisual.vue'
import type { Question } from '@/types'
import type { PhotoGalleryEntry } from '@/api/reports'

const makeQuestion = (overrides: Partial<Question> = {}): Question => ({
  id: 1,
  question: 'Тестовый вопрос',
  type: 'number',
  can_skip: false,
  order_index: 0,
  is_active: true,
  is_habit: false,
  target_value: null,
  createdAt: '2024-01-01',
  schedule: { id: 1, frequency_type: 'daily', days_of_week: null, interval_days: null },
  ...overrides,
})

describe('QuestionVisual', () => {
  it('рендерит PhotoGalleryVisual для question.type === "photo"', () => {
    const entries: PhotoGalleryEntry[] = [
      { scheduled_date: '2024-01-15', url: 'https://cdn.example.com/photo1.jpg' },
    ]
    const wrapper = mount(QuestionVisual, {
      props: {
        question: makeQuestion({ type: 'photo' }),
        dataPoints: [],
        accent: '#8b5cf6',
        photoEntries: entries,
      },
      attachTo: document.body,
    })

    expect(wrapper.findComponent(PhotoGalleryVisual).exists()).toBe(true)

    wrapper.unmount()
  })

  it('не рендерит PhotoGalleryVisual для числового вопроса', () => {
    const wrapper = mount(QuestionVisual, {
      props: {
        question: makeQuestion({ type: 'number' }),
        dataPoints: [{ date: '2024-01-15', value: 42, filled: true, label: '42' }],
        accent: '#8b5cf6',
      },
    })

    expect(wrapper.findComponent(PhotoGalleryVisual).exists()).toBe(false)
  })
})
