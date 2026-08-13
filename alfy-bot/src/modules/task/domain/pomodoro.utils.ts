/**
 * Tolerance for the float accumulation of fractional pomodoro increments.
 * `pomodoroCompleted` is a `real` column summed via SQL `x = x + n`, so a value
 * that logically equals the target may be stored as 3.9999999.
 */
export const POMODORO_EPSILON = 1e-6;

/**
 * True when this increment moved the task across its pomodoro target.
 *
 * Deliberately a transition check, not a `after >= target` check: a task whose
 * counter is already at or above the target must not be re-completed, which is
 * what lets a user uncheck an auto-completed task and keep working on it.
 */
export function hasCrossedPomodoroTarget(
  before: number,
  after: number,
  target: number,
): boolean {
  if (target <= 0) return false;
  const threshold = target - POMODORO_EPSILON;
  return before < threshold && after >= threshold;
}
