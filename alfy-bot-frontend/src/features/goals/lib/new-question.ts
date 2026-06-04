import type { QuestionWithScheduleItem } from '@/api/goals'

/**
 * Дефолт нового вопроса для формы добавления к цели.
 * Новый объект на каждый вызов — чтобы не шарить ссылку между открытиями Sheet.
 * Лейблы типов/расписаний форма подтягивает из конфигов сама.
 */
export function newQuestionDraft(): QuestionWithScheduleItem {
  return {
    question: '',
    type: 'text',
    canSkip: false,
    scheduleType: 'daily',
  }
}
