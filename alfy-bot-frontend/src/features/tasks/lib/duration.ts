import type { Task } from '../model/types'
import { POMODORO_DEFAULTS } from '../model/constants'

const MAX_POMODORO_COUNT = 10

export function computePomodoroTotalMinutes(
  count: number,
  duration = POMODORO_DEFAULTS.duration,
  shortBreak = POMODORO_DEFAULTS.shortBreak,
  longBreak = POMODORO_DEFAULTS.longBreak,
  interval = POMODORO_DEFAULTS.longBreakInterval,
): number {
  let total = count * duration
  for (let i = 1; i < count; i++) {
    total += (i % interval === 0) ? longBreak : shortBreak
  }
  return total
}

export function computeTaskDurationMinutes(task: Task): number {
  if (!task.isPomodoroTask)
    return task.durationMinutes ?? 60

  return computePomodoroTotalMinutes(
    task.pomodoroCount ?? POMODORO_DEFAULTS.count,
    task.pomodoroDuration ?? POMODORO_DEFAULTS.duration,
    task.shortBreak ?? POMODORO_DEFAULTS.shortBreak,
    task.longBreak ?? POMODORO_DEFAULTS.longBreak,
    task.longBreakInterval ?? POMODORO_DEFAULTS.longBreakInterval,
  )
}

export function countFromDurationMinutes(total: number): number {
  let best = 1
  let bestDiff = Infinity
  for (let count = 1; count <= MAX_POMODORO_COUNT; count++) {
    const diff = Math.abs(computePomodoroTotalMinutes(count) - total)
    if (diff < bestDiff) {
      bestDiff = diff
      best = count
    }
  }
  return best
}
