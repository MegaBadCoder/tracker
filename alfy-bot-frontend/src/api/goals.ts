import { api } from './client'
import type { FrequencyType, Goal, GoalStatus, Question, Schedule } from '../types'

export interface UpdateScheduleDto {
  frequency_type: FrequencyType
  days_of_week?: number[]
  interval_days?: number
}

export async function fetchGoals(status?: Exclude<GoalStatus, 'all'>): Promise<Goal[]> {
  const { data } = await api.get<Goal[]>('/goals', {
    params: status ? { status } : undefined,
  })
  return data
}

export async function fetchGoalById(id: number): Promise<Goal> {
  const { data } = await api.get<Goal>(`/goals/${id}`)
  return data
}

export async function fetchQuestion(questionId: number): Promise<Question> {
  const { data } = await api.get<Question>(`/questions/${questionId}`)
  return data
}

export async function updateQuestion(
  questionId: number,
  dto: { is_habit?: boolean; question?: string },
): Promise<Question> {
  const { data } = await api.patch<Question>(`/questions/${questionId}`, dto)
  return data
}

export async function updateQuestionSchedule(
  questionId: number,
  dto: UpdateScheduleDto,
): Promise<Schedule> {
  const { data } = await api.patch<Schedule>(
    `/questions/${questionId}/schedule`,
    dto,
  )
  return data
}
