import type { Task } from '../model/types'
import { computeTaskDurationMinutes } from './duration'

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
      if (!task.dueDate) return false
      if (task.completed) return false
      if (task.isOverdue) return false

      const start = new Date(task.dueDate)
      // A task pinned to exactly 00:00 is all-day, same rule the calendar uses
      // in calendar-events.ts — it has no meaningful window.
      if (start.getHours() === 0 && start.getMinutes() === 0) return false

      const startMs = start.getTime()
      const endMs = startMs + computeTaskDurationMinutes(task) * 60_000

      // End is exclusive so two back-to-back tasks never show up together.
      return startMs <= nowMs && nowMs < endMs
    })
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
}
