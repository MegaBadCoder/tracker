import type { QuestionType } from '../types'
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

export interface QuestionReportItem {
  questionId: number
  question: string
  type: QuestionType
  can_skip: boolean
  target_value?: string | null
  answered: boolean
  answer_text: string | null
  answer_number: number | null
  answer_bool: boolean | null
}

export interface GoalReportStatus {
  goalId: number
  date: string
  lastUnfilledDate: string | null
  questions: QuestionReportItem[]
  allDone: boolean
}

export interface ReportQueueItem {
  goalId: number
  goalName: string
  pendingCount: number
}

export async function fetchGoalReportStatus(goalId: number, date: string): Promise<GoalReportStatus> {
  const { data } = await api.get<GoalReportStatus>(`/goals/${goalId}/report-status`, { params: { date } })
  return data
}

export async function fetchReportQueue(date: string): Promise<ReportQueueItem[]> {
  const { data } = await api.get<ReportQueueItem[]>('/goals/report-queue', { params: { date } })
  return data
}

export async function submitAnswer(questionId: number, scheduledDate: string, answer: string): Promise<void> {
  await api.post(`/questions/${questionId}/answers`, { scheduled_date: scheduledDate, answer })
}

export async function submitPhotoAnswer(questionId: number, scheduledDate: string, file: File): Promise<void> {
  const form = new FormData()
  form.append('photo', file)
  form.append('scheduled_date', scheduledDate)
  await api.post(`/questions/${questionId}/answers/photo`, form)
}
