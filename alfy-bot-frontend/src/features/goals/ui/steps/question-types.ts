import type { QuestionType } from '@/types'

/**
 * Локальная копия `QUESTION_TYPES` с бэка (`alfy-bot/src/shared/types/question-types.ts`).
 * Источник истины — бот; фронт держит копию рядом с UI, чтобы не зависеть
 * от другого пакета. Бот показывает типы БЕЗ эмодзи — фронт делает так же.
 *
 * `options` для `emoji_rating`/`yes_no`/`time_spent`/`rating` — это ВАРИАНТЫ
 * ОТВЕТА (контент, не декор): их рендерят answer-inputs. Эмодзи в emoji_rating
 * остаются — это сами варианты оценки.
 */
export interface QuestionTypeOption {
  type: QuestionType
  label: string
  example: string
  options?: (string | number)[]
}

export const QUESTION_TYPE_OPTIONS: QuestionTypeOption[] = [
  { type: 'text', label: 'Текстовый ввод', example: 'Что сделал сегодня?' },
  { type: 'rating', label: 'Оценка (числа)', example: 'Оцени продуктивность (1-5)', options: [1, 2, 3, 4, 5] },
  { type: 'emoji_rating', label: 'Оценка (смайлики)', example: 'Как прошёл день?', options: ['😕', '😐', '🙂', '😊', '🔥'] },
  { type: 'yes_no', label: 'Да/Нет', example: 'Выполнил запланированное?', options: ['Да', 'Нет'] },
  { type: 'number', label: 'Число', example: 'Сколько страниц написал?' },
  { type: 'time_spent', label: 'Затраченное время', example: 'Сколько времени потратил?', options: ['<30 мин', '30-60', '1-2ч', '2+ч'] },
  { type: 'photo', label: 'Фото', example: 'Сделай фото себя сегодня' },
]

export function findQuestionTypeOption(type: QuestionType): QuestionTypeOption {
  const found = QUESTION_TYPE_OPTIONS.find(o => o.type === type)
  if (!found)
    throw new Error(`Unknown question type: ${type}`)
  return found
}
