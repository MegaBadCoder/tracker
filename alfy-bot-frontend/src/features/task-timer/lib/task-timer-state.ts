export type TaskTimerState = 'idle' | 'running' | 'paused'

export interface TimerSnapshot {
  /** Task the current session belongs to, null when no task is selected. */
  activeTaskId: string | null
  /** 0 means no session is armed. */
  phase: number
  /** Whether the session is ticking rather than paused. */
  isActive: boolean
}

/**
 * What the pomodoro timer is doing for one particular task.
 *
 * `idle` covers both "nothing runs" and "something else runs" — from the row's
 * point of view those are the same: starting here would take the timer over.
 */
export function getTaskTimerState(taskId: string, timer: TimerSnapshot): TaskTimerState {
  if (timer.activeTaskId !== taskId) return 'idle'
  if (timer.phase === 0) return 'idle'
  return timer.isActive ? 'running' : 'paused'
}
