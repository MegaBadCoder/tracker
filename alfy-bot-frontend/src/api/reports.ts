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

export interface PhotoGalleryEntry {
  scheduled_date: string
  url: string
}

export async function fetchPhotoGallery(
  questionId: number,
  limit = 50,
  offset = 0,
): Promise<PhotoGalleryEntry[]> {
  const { data } = await api.get<PhotoGalleryEntry[]>(`/questions/${questionId}/photo-gallery`, { params: { limit, offset } })
  return data
}
