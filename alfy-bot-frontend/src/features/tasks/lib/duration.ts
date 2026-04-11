import type { Task } from '../model/types'
import { POMODORO_DEFAULTS } from '../model/constants'

export function computeTaskDurationMinutes(task: Task): number {
  if (!task.isPomodoroTask) return task.durationMinutes ?? 60

  const count = task.pomodoroCount ?? POMODORO_DEFAULTS.count
  const duration = task.pomodoroDuration ?? POMODORO_DEFAULTS.duration
  const shortBreak = task.shortBreak ?? POMODORO_DEFAULTS.shortBreak
  const longBreak = task.longBreak ?? POMODORO_DEFAULTS.longBreak
  const interval = task.longBreakInterval ?? POMODORO_DEFAULTS.longBreakInterval

  let total = count * duration
  for (let i = 1; i < count; i++) {
    total += (i % interval === 0) ? longBreak : shortBreak
  }
  return total
}
