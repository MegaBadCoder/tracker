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
  options?: (string | number)[]
}

export const QUESTION_TYPE_OPTIONS: QuestionTypeOption[] = [
  { type: 'text', emoji: '📝', label: 'Текстовый ввод', example: 'Что сделал сегодня?' },
  { type: 'rating', emoji: '⭐', label: 'Оценка (числа)', example: 'Оцени продуктивность (1-5)', options: [1, 2, 3, 4, 5] },
  { type: 'emoji_rating', emoji: '😊', label: 'Оценка (смайлики)', example: 'Как прошёл день?', options: ['😕', '😐', '🙂', '😊', '🔥'] },
  { type: 'yes_no', emoji: '✅', label: 'Да/Нет', example: 'Выполнил запланированное?', options: ['Да', 'Нет'] },
  { type: 'number', emoji: '🔢', label: 'Число', example: 'Сколько страниц написал?' },
  { type: 'time_spent', emoji: '⏱', label: 'Затраченное время', example: 'Сколько времени потратил?', options: ['<30 мин', '30-60', '1-2ч', '2+ч'] },
  { type: 'photo', emoji: '📷', label: 'Фото', example: 'Сделай фото себя сегодня' },
]

export function findQuestionTypeOption(type: QuestionType): QuestionTypeOption {
  const found = QUESTION_TYPE_OPTIONS.find(o => o.type === type)
  if (!found)
    throw new Error(`Unknown question type: ${type}`)
  return found
}
