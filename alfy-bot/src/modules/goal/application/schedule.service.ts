import { Injectable } from '@nestjs/common';
import { Goal, Question, Schedule } from '../../../shared/entities';

/** Форматирует Date в 'YYYY-MM-DD' по локальному времени */
function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Injectable()
export class ScheduleService {
  /**
   * Finds the schedule that was effective on a given date.
   * Returns the schedule with the largest effective_from <= date.
   */
  getScheduleForDate(
    schedules: Schedule[],
    date: Date,
  ): Schedule | null {
    if (!schedules || schedules.length === 0) return null;

    const dateStr = toLocalISO(date);
    let best: Schedule | null = null;

    for (const s of schedules) {
      const ef = s.effective_from;
      if (!ef || ef <= dateStr) {
        if (!best) {
          best = s;
        } else {
          const bestEf = best.effective_from;
          if (!bestEf) {
            best = s;
          } else if (ef && ef > bestEf) {
            best = s;
          }
        }
      }
    }

    return best;
  }

  /**
   * Checks if a specific schedule is due on a given date.
   */
  isScheduleDueOnDate(
    schedule: Schedule,
    goalStart: string,
    date: Date,
  ): boolean {
    if (!schedule) return true;

    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    switch (schedule.frequency_type) {
      case 'daily':
        return true;
      case 'weekly_days': {
        const days = schedule.days_of_week ?? [];
        return days.includes(target.getDay());
      }
      case 'interval': {
        const startDate = new Date(goalStart);
        startDate.setHours(0, 0, 0, 0);
        const diffMs = target.getTime() - startDate.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays % (schedule.interval_days || 1) === 0;
      }
      default:
        return true;
    }
  }

  /**
   * Backward-compat wrapper: uses question.schedule (latest) to check if due on date.
   * Suitable for "is due today" checks where only the current schedule matters.
   */
  isQuestionDueOnDate(
    question: Question,
    goalStart: string,
    date: Date,
  ): boolean {
    const schedule = question.schedule;
    if (!schedule) return true;
    return this.isScheduleDueOnDate(schedule, goalStart, date);
  }

  /**
   * History-aware check: resolves the correct schedule for the given date
   * from the question's schedule history, then checks if due.
   */
  isQuestionDueOnDateHistorical(
    question: Question,
    goalStart: string,
    date: Date,
  ): boolean {
    const schedule = this.getScheduleForDate(question.schedules, date);
    if (!schedule) return true;
    return this.isScheduleDueOnDate(schedule, goalStart, date);
  }

  isQuestionDueToday(question: Question, goalStart: string): boolean {
    return this.isQuestionDueOnDate(question, goalStart, new Date());
  }

  hasAnyQuestionDueToday(goal: Goal): boolean {
    const activeQuestions = (goal.questions || []).filter((q) => q.is_active);
    return activeQuestions.some((q) =>
      this.isQuestionDueToday(q, goal.goal_start),
    );
  }

  filterDueQuestions(
    questions: Question[],
    goalStart: string,
  ): Question[] {
    return questions.filter((q) => this.isQuestionDueToday(q, goalStart));
  }
}
