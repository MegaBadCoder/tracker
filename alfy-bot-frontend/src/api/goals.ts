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

export async function fetchQuestionById(questionId: number): Promise<Question> {
  const { data } = await api.get<Question>(`/goals/questions/${questionId}`)
  return data
}

export async function updateQuestionSchedule(
  questionId: number,
  dto: UpdateScheduleDto,
): Promise<Schedule> {
  const { data } = await api.patch<Schedule>(
    `/goals/questions/${questionId}/schedule`,
    dto,
  )
  return data
}
