export interface AnalyticsEntry {
  date: string;
  answer_text: string | null;
  answer_number: number | null;
  answer_bool: boolean | null;
  filled: boolean;
}

export interface GoalSummary {
  id: number;
  goal_name: string;
  status: string;
  goal_start: string;
  goal_end: string;
  questions: Array<{ id: number }>;
}

export interface TaskSummary {
  id: string;
  title: string;
  completed: boolean;
  dueDate: string | null;
}

export interface ProgressReport {
  goals: Array<{
    id: number;
    name: string;
    answered: number;
    scheduled: number;
    missed: number;
    streak: number;
  }>;
  tasks: {
    total: number;
    completed: number;
    overdue: number;
  };
}

/**
 * Pure function — takes pre-fetched data, returns aggregated ProgressReport.
 *
 * answered / scheduled / missed:
 *   Count question-on-date instances in the period.
 *   For each question, each analytics entry in the period where the question was due
 *   (filled=true OR filled=false) counts as 1 scheduled.
 *   answered = entries where filled=true.
 *   missed   = scheduled - answered.
 *
 * streak = consecutive scheduled days from most recent backwards where ALL questions
 *          with entries for that day were filled.
 *          A "day is counted" only if at least one question has an analytics entry.
 *          Days where no question was scheduled are skipped (not_due).
 *          Streak breaks at the first day where any scheduled question was not filled.
 */
export function aggregateProgress(
  period: 'today' | 'week',
  goals: GoalSummary[],
  tasks: TaskSummary[],
  analyticsByQuestion: Map<number, AnalyticsEntry[]>,
  now: Date,
): ProgressReport {
  const todayStr = formatDate(now);
  const periodStart = period === 'today' ? todayStr : formatDate(subtractDays(now, 6));

  // --- Task aggregation ---
  const todayDate = parseDate(todayStr);
  const taskAgg = tasks.reduce(
    (acc, t) => {
      acc.total++;
      if (t.completed) {
        acc.completed++;
      } else if (t.dueDate !== null) {
        const due = new Date(t.dueDate);
        // Strip time — compare date only
        const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        const nowDay = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
        if (dueDay < nowDay) acc.overdue++;
      }
      return acc;
    },
    { total: 0, completed: 0, overdue: 0 },
  );

  // --- Goal aggregation ---
  const goalResults = goals.map((goal) => {
    const questionIds = goal.questions.map((q) => q.id);

    if (questionIds.length === 0) {
      return { id: goal.id, name: goal.goal_name, answered: 0, scheduled: 0, missed: 0, streak: 0 };
    }

    // Count per-question per-date instances in the period
    let scheduled = 0;
    let answered = 0;

    for (const qId of questionIds) {
      const entries = analyticsByQuestion.get(qId) ?? [];
      for (const entry of entries) {
        if (entry.date >= periodStart && entry.date <= todayStr) {
          scheduled++;
          if (entry.filled) answered++;
        }
      }
    }

    const missed = scheduled - answered;
    const streak = computeStreak(questionIds, analyticsByQuestion, todayStr);

    return { id: goal.id, name: goal.goal_name, answered, scheduled, missed, streak };
  });

  return {
    goals: goalResults,
    tasks: taskAgg,
  };
}

/**
 * Computes streak: consecutive scheduled days from most-recent backwards where ALL
 * questions with entries for that day were filled.
 *
 * A "day" is counted only if at least one question has an analytics entry for it.
 * Days where no question was scheduled are skipped.
 */
function computeStreak(
  questionIds: number[],
  analyticsByQuestion: Map<number, AnalyticsEntry[]>,
  todayStr: string,
): number {
  if (questionIds.length === 0) return 0;

  // Collect all unique scheduled dates across all questions
  const allScheduledDates = new Set<string>();
  for (const qId of questionIds) {
    const entries = analyticsByQuestion.get(qId) ?? [];
    for (const e of entries) {
      allScheduledDates.add(e.date);
    }
  }

  if (allScheduledDates.size === 0) return 0;

  // Sort descending (most recent first)
  const sortedDesc = Array.from(allScheduledDates).sort().reverse();

  let streak = 0;
  for (const date of sortedDesc) {
    // Check if all questions that have entries for this date are filled
    let allFilled = true;
    let anyEntry = false;

    for (const qId of questionIds) {
      const entries = analyticsByQuestion.get(qId) ?? [];
      const entry = entries.find((e) => e.date === date);
      if (entry !== undefined) {
        anyEntry = true;
        if (!entry.filled) {
          allFilled = false;
          break;
        }
      }
    }

    if (!anyEntry) continue; // not a scheduled day — skip
    if (allFilled) {
      streak++;
    } else {
      break; // streak broken
    }
  }

  return streak;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function subtractDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() - days);
  return result;
}

function parseDate(dateStr: string): Date {
  // Parse YYYY-MM-DD as local date
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, (m as number) - 1, day as number);
}
