export type GoalStatus = 'active' | 'completed' | 'archived' | 'deleted'
export type GoalType = 'SIMPLE' | 'SMART' | 'GLOBAL'
export type QuestionType = 'number' | 'text' | 'rating' | 'emoji_rating' | 'yes_no' | 'time_spent' | 'photo'
export type FrequencyType = 'daily' | 'weekly_days' | 'interval'
export type ReportStatus = 'completed' | 'skipped' | 'in_progress' | 'expired' | 'cancelled'

export interface Schedule {
  id: number
  frequency_type: FrequencyType
  days_of_week: number[] | null
  interval_days: number | null
}

export interface Question {
  id: number
  question: string
  type: QuestionType
  can_skip: boolean
  order_index: number
  is_active: boolean
  is_habit: boolean
  target_value?: string | null
  createdAt: string
  schedule: Schedule
}

export interface Answer {
  questionId: number
  value: number | string | boolean
}

export interface ReportAnswer {
  questionId: number
  answer_text?: string | null
  answer_number?: number | null
  answer_bool?: boolean | null
}

export interface Report {
  id: string
  goalId: number
  date: string
  status: ReportStatus
  answers: ReportAnswer[]
}

export interface Goal {
  id: number
  goal_name: string
  goal_start: string
  goal_end: string
  status: GoalStatus
  createdAt: string
  questions: Question[]
}

export type HabitHistoryStatus = 'filled' | 'not_filled' | 'not_due'

export interface HabitHistoryEntry {
  date: string
  status: HabitHistoryStatus
}

export interface HabitWithHistory {
  id: number
  question: string
  type: QuestionType
  can_skip: boolean
  is_active: boolean
  createdAt: string
  history: HabitHistoryEntry[]
}
