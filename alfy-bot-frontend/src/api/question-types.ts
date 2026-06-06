import type { QuestionType } from '@/types'
import { api } from '@/api/client'

/**
 * Метаданные типа вопроса, отдаваемые бэком (`GET /api/question-types`).
 * Источник истины — бот; фронт только кэширует через `question-types-store`.
 *
 * `options` для `emoji_rating`/`yes_no`/`time_spent`/`rating` — это ВАРИАНТЫ
 * ОТВЕТА (контент, не декор): их рендерят answer-inputs.
 */
export interface QuestionTypeOption {
  type: QuestionType
  label: string
  example: string
  options?: (string | number)[]
}

export async function fetchQuestionTypes(): Promise<QuestionTypeOption[]> {
  const { data } = await api.get<QuestionTypeOption[]>('/question-types')
  return data
}
