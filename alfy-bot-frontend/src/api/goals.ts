import type { FrequencyType, Goal, GoalStatus, Question, QuestionType, Schedule } from '../types'
import { api } from './client'

export interface UpdateScheduleDto {
  frequency_type: FrequencyType
  days_of_week?: number[]
  interval_days?: number
}

export interface CreateGoalDto {
  goal_name: string
  goal_start: string
  goal_end: string
}

export interface QuestionWithScheduleItem {
  question: string
  type: QuestionType
  canSkip: boolean
  scheduleType: FrequencyType
  selectedDays?: number[]
  intervalDays?: number
  targetValue?: string
}

export interface UpdateGoalDto {
  status?: 'active' | 'completed' | 'deleted'
  goal_name?: string
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
  dto: { is_habit?: boolean, question?: string },
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

export async function createGoal(dto: CreateGoalDto): Promise<Goal> {
  const { data } = await api.post<Goal>('/goals', dto)
  return data
}

export async function addGoalQuestions(
  goalId: number,
  items: QuestionWithScheduleItem[],
): Promise<Question[]> {
  const { data } = await api.post<Question[]>(`/goals/${goalId}/questions`, {
    questions: items,
  })
  return data
}

export async function updateGoal(
  goalId: number,
  dto: UpdateGoalDto,
): Promise<Goal> {
  const { data } = await api.patch<Goal>(`/goals/${goalId}`, dto)
  return data
}
