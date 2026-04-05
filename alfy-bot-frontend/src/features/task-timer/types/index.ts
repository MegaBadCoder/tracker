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

// Service Worker message types

export interface TimerStartMessage {
  type: 'TIMER_START'
  data: { id: string; expiresAt: number; phaseName: string }
}

export interface TimerPauseMessage {
  type: 'TIMER_PAUSE'
  data: { id: string }
}

export interface TimerStopMessage {
  type: 'TIMER_STOP'
  data: { id: string }
}

export type TimerSWMessage = TimerStartMessage | TimerPauseMessage | TimerStopMessage
