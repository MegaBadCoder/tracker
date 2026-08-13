import type { Task } from '../model/types'
import { computeTaskDurationMinutes } from './duration'

export interface TaskProgress {
  /** Share of the window already elapsed, clamped to 0..1. */
  ratio: number
  remainingMinutes: number
}

interface TaskWindow {
  startMs: number
  endMs: number
}

/**
 * The task's scheduled window, or null when it has none.
 *
 * Single definition of "when does this task run" — both the active-task filter
 * and the progress readout are built on it, so they can never disagree.
 */
function getWindow(task: Task): TaskWindow | null {
  if (!task.dueDate) return null

  const start = new Date(task.dueDate)
  // A task pinned to exactly 00:00 is all-day, same rule the calendar uses
  // in calendar-events.ts — it has no meaningful window.
  if (start.getHours() === 0 && start.getMinutes() === 0) return null

  const startMs = start.getTime()
  return { startMs, endMs: startMs + computeTaskDurationMinutes(task) * 60_000 }
}

/**
 * Tasks whose scheduled window contains `now` — what the calendar's red line
 * crosses right now.
 *
 * `now` is an argument rather than read from the clock so the rule stays pure
 * and testable without faking timers.
 */
export function getActiveTasksAt(tasks: Task[], now: Date): Task[] {
  const nowMs = now.getTime()

  return tasks
    .filter((task) => {
      if (task.completed) return false
      if (task.isOverdue) return false

      const window = getWindow(task)
      if (!window) return false

      // End is exclusive so two back-to-back tasks never show up together.
      return window.startMs <= nowMs && nowMs < window.endMs
    })
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
}

/** How far into its window a task is, or null when it has no window. */
export function getTaskProgressAt(task: Task, now: Date): TaskProgress | null {
  const window = getWindow(task)
  if (!window) return null

  const total = window.endMs - window.startMs
  const elapsed = now.getTime() - window.startMs

  return {
    ratio: total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0,
    remainingMinutes: Math.max(0, Math.ceil((window.endMs - now.getTime()) / 60_000)),
  }
}
