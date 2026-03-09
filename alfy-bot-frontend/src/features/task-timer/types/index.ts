export interface TimerSettings {
  pomodoroTime: number
  breakTime: number
  longBreakTime: number
  longBreakInterval: number
  countPomodoro: number
  taskId: string | null
}

export interface TimerSession {
  lastStartTime: number | null
  phase: number
  taskId: string | null
  countTimeAfterPause: number | null
  taskSettings: Omit<TimerSettings, 'taskId'>
}

export interface PhaseInfo {
  time: number
  name: string
}

export type SessionStateType = 'PAUSED' | 'ACTIVE' | 'EXPIRED' | 'INVALID'

export interface SessionState {
  type: SessionStateType
  remainingTime?: number
}

export interface Task {
  id: string
  pomodoroTime: number
  breakTime: number
  longBreakTime: number
  longBreakInterval: number
  pomodoroCount: number
}
