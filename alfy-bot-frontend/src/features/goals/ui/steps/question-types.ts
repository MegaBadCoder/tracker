import type { QuestionType } from '@/types'

/**
 * Локальная копия `QUESTION_TYPES` с бэка (`alfy-bot/src/shared/types/question-types.ts`).
 * Источник истины — бот; фронт держит копию рядом с UI, чтобы не зависеть
 * от другого пакета.
 */
export interface QuestionTypeOption {
  type: QuestionType
  emoji: string
  label: string
  example: string
}

export const QUESTION_TYPE_OPTIONS: QuestionTypeOption[] = [
  { type: 'text', emoji: '📝', label: 'Текстовый ввод', example: 'Что сделал сегодня?' },
  { type: 'rating', emoji: '⭐', label: 'Оценка (числа)', example: 'Оцени продуктивность (1-5)' },
  { type: 'emoji_rating', emoji: '😊', label: 'Оценка (смайлики)', example: 'Как прошёл день?' },
  { type: 'yes_no', emoji: '✅', label: 'Да/Нет', example: 'Выполнил запланированное?' },
  { type: 'number', emoji: '🔢', label: 'Число', example: 'Сколько страниц написал?' },
  { type: 'time_spent', emoji: '⏱', label: 'Затраченное время', example: 'Сколько времени потратил?' },
]

export function findQuestionTypeOption(type: QuestionType): QuestionTypeOption {
  const found = QUESTION_TYPE_OPTIONS.find(o => o.type === type)
  if (!found)
    throw new Error(`Unknown question type: ${type}`)
  return found
}
