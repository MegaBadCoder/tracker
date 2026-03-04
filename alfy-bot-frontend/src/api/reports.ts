import { api } from './client'

export interface AnalyticsEntry {
  date: string
  answer_text: string | null
  answer_number: number | null
  answer_bool: boolean | null
  filled: boolean
}

export async function fetchQuestionAnalytics(questionId: number): Promise<AnalyticsEntry[]> {
  const { data } = await api.get<AnalyticsEntry[]>(`/questions/${questionId}/analytics`)
  return data
}
