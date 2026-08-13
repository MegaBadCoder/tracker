import type { Task as TaskEntity } from '@/features/tasks/model/types'
import type { Task as TimerTask } from '../types'
import { POMODORO_DEFAULTS } from '@/features/tasks/model/constants'

/**
 * Map a task onto the shape `timerStore.startTask` expects.
 *
 * Uses `||` rather than `??` on purpose: this preserves the behaviour of the
 * call sites this helper replaced, where a stored 0 collapses to the default
 * instead of starting a zero-length pomodoro.
 */
export function toTimerTask(task: TaskEntity): TimerTask {
  return {
    id: task.id,
    pomodoroTime: task.pomodoroDuration || POMODORO_DEFAULTS.duration,
    breakTime: task.shortBreak || POMODORO_DEFAULTS.shortBreak,
    longBreakTime: task.longBreak || POMODORO_DEFAULTS.longBreak,
    longBreakInterval: task.longBreakInterval || POMODORO_DEFAULTS.longBreakInterval,
    pomodoroCount: task.pomodoroCount || POMODORO_DEFAULTS.count,
  }
}
