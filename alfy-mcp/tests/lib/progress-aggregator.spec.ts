import { describe, it, expect } from 'vitest';
import { aggregateProgress } from '../../src/lib/progress-aggregator.js';
import type { GoalSummary, TaskSummary, AnalyticsEntry } from '../../src/lib/progress-aggregator.js';

// 2026-05-19 Monday (fixed reference)
const NOW = new Date('2026-05-19T12:00:00.000Z');

const activeGoal: GoalSummary = {
  id: 1,
  goal_name: 'Read daily',
  status: 'active',
  goal_start: '2026-01-01',
  goal_end: '2026-12-31',
  questions: [{ id: 10 }, { id: 11 }],
};

const completedGoal: GoalSummary = {
  id: 2,
  goal_name: 'Old goal',
  status: 'completed',
  goal_start: '2026-01-01',
  goal_end: '2026-04-01',
  questions: [],
};

const pendingTask: TaskSummary = { id: 't-0000-0000-0000-000000000001', title: 'A', completed: false, dueDate: '2026-05-20T00:00:00.000Z' };
const completedTask: TaskSummary = { id: 't-0000-0000-0000-000000000002', title: 'B', completed: true, dueDate: '2026-05-19T00:00:00.000Z' };
const overdueTask: TaskSummary = { id: 't-0000-0000-0000-000000000003', title: 'C', completed: false, dueDate: '2026-05-10T00:00:00.000Z' };
const noDateTask: TaskSummary = { id: 't-0000-0000-0000-000000000004', title: 'D', completed: false, dueDate: null };

// Analytics for question 10: today + yesterday filled
const analyticsQ10: AnalyticsEntry[] = [
  { date: '2026-05-19', filled: true, answer_text: 'yes', answer_number: null, answer_bool: null },
  { date: '2026-05-18', filled: true, answer_text: 'yes', answer_number: null, answer_bool: null },
  { date: '2026-05-17', filled: false, answer_text: null, answer_number: null, answer_bool: null },
];

// Analytics for question 11: today not filled, yesterday filled
const analyticsQ11: AnalyticsEntry[] = [
  { date: '2026-05-19', filled: false, answer_text: null, answer_number: null, answer_bool: null },
  { date: '2026-05-18', filled: true, answer_text: 'yes', answer_number: null, answer_bool: null },
];

describe('aggregateProgress', () => {
  describe('empty fixture', () => {
    it('returns empty goals and zero task counts when nothing provided', () => {
      const report = aggregateProgress('today', [], [], new Map(), NOW);
      expect(report.goals).toEqual([]);
      expect(report.tasks.total).toBe(0);
      expect(report.tasks.completed).toBe(0);
      expect(report.tasks.overdue).toBe(0);
    });
  });

  describe('task aggregation', () => {
    it('counts total, completed, overdue tasks correctly', () => {
      const tasks = [pendingTask, completedTask, overdueTask, noDateTask];
      const report = aggregateProgress('today', [], tasks, new Map(), NOW);
      expect(report.tasks.total).toBe(4);
      expect(report.tasks.completed).toBe(1);
      // overdueTask has dueDate before today and is not completed
      expect(report.tasks.overdue).toBe(1);
    });

    it('does not count completed tasks as overdue', () => {
      const tasks = [completedTask];
      const report = aggregateProgress('today', [], tasks, new Map(), NOW);
      expect(report.tasks.overdue).toBe(0);
    });

    it('does not count tasks without due date as overdue', () => {
      const tasks = [noDateTask];
      const report = aggregateProgress('today', [], tasks, new Map(), NOW);
      expect(report.tasks.overdue).toBe(0);
    });
  });

  describe('goal aggregation — period: today', () => {
    it('includes goals in result', () => {
      const analyticsMap = new Map<number, AnalyticsEntry[]>([
        [10, analyticsQ10],
        [11, analyticsQ11],
      ]);
      const report = aggregateProgress('today', [activeGoal, completedGoal], [], analyticsMap, NOW);
      expect(report.goals).toHaveLength(2);
    });

    it('counts answered questions for today', () => {
      const analyticsMap = new Map<number, AnalyticsEntry[]>([
        [10, analyticsQ10],
        [11, analyticsQ11],
      ]);
      const report = aggregateProgress('today', [activeGoal], [], analyticsMap, NOW);
      const goal = report.goals[0];
      // Q10 is filled today, Q11 is not filled today
      expect(goal.answered).toBe(1);
    });

    it('counts scheduled questions for today', () => {
      const analyticsMap = new Map<number, AnalyticsEntry[]>([
        [10, analyticsQ10],
        [11, analyticsQ11],
      ]);
      const report = aggregateProgress('today', [activeGoal], [], analyticsMap, NOW);
      const goal = report.goals[0];
      // Both Q10 and Q11 have entries for today (filled or not_filled = scheduled)
      expect(goal.scheduled).toBe(2);
    });

    it('computes missed = scheduled - answered', () => {
      const analyticsMap = new Map<number, AnalyticsEntry[]>([
        [10, analyticsQ10],
        [11, analyticsQ11],
      ]);
      const report = aggregateProgress('today', [activeGoal], [], analyticsMap, NOW);
      const goal = report.goals[0];
      expect(goal.missed).toBe(goal.scheduled - goal.answered);
    });
  });

  describe('goal aggregation — streak calculation', () => {
    it('returns streak=0 when no questions answered', () => {
      const noAnswers: AnalyticsEntry[] = [
        { date: '2026-05-19', filled: false, answer_text: null, answer_number: null, answer_bool: null },
        { date: '2026-05-18', filled: false, answer_text: null, answer_number: null, answer_bool: null },
      ];
      const analyticsMap = new Map<number, AnalyticsEntry[]>([[10, noAnswers]]);
      const singleQ: GoalSummary = { ...activeGoal, questions: [{ id: 10 }] };
      const report = aggregateProgress('today', [singleQ], [], analyticsMap, NOW);
      expect(report.goals[0].streak).toBe(0);
    });

    it('returns streak=2 when 2 consecutive answered days (latest backwards)', () => {
      // Q10: today filled, yesterday filled, 2 days ago not filled → streak=2
      const analyticsMap = new Map<number, AnalyticsEntry[]>([[10, analyticsQ10]]);
      const singleQ: GoalSummary = { ...activeGoal, questions: [{ id: 10 }] };
      const report = aggregateProgress('today', [singleQ], [], analyticsMap, NOW);
      // Today filled, yesterday filled, day before not → streak = 2
      expect(report.goals[0].streak).toBe(2);
    });

    it('breaks streak at first missed (not_due days ignored)', () => {
      // Only days that were scheduled (filled or missed): streak breaks at first missed
      const analytics: AnalyticsEntry[] = [
        { date: '2026-05-19', filled: true, answer_text: null, answer_number: null, answer_bool: null },
        { date: '2026-05-18', filled: false, answer_text: null, answer_number: null, answer_bool: null }, // missed
        { date: '2026-05-17', filled: true, answer_text: null, answer_number: null, answer_bool: null },
      ];
      const analyticsMap = new Map<number, AnalyticsEntry[]>([[10, analytics]]);
      const singleQ: GoalSummary = { ...activeGoal, questions: [{ id: 10 }] };
      const report = aggregateProgress('today', [singleQ], [], analyticsMap, NOW);
      expect(report.goals[0].streak).toBe(1);
    });

    it('returns streak=0 when goal has no questions', () => {
      const emptyGoal: GoalSummary = { ...activeGoal, questions: [] };
      const report = aggregateProgress('today', [emptyGoal], [], new Map(), NOW);
      expect(report.goals[0].streak).toBe(0);
    });
  });

  describe('goal aggregation — period: week', () => {
    it('counts across all 7 days for the week period', () => {
      // Create analytics spanning a week with mixed filled/not
      const weekAnalytics: AnalyticsEntry[] = [
        { date: '2026-05-19', filled: true, answer_text: null, answer_number: null, answer_bool: null },
        { date: '2026-05-18', filled: true, answer_text: null, answer_number: null, answer_bool: null },
        { date: '2026-05-17', filled: false, answer_text: null, answer_number: null, answer_bool: null },
        { date: '2026-05-16', filled: true, answer_text: null, answer_number: null, answer_bool: null },
        { date: '2026-05-15', filled: false, answer_text: null, answer_number: null, answer_bool: null },
        { date: '2026-05-14', filled: true, answer_text: null, answer_number: null, answer_bool: null },
        { date: '2026-05-13', filled: true, answer_text: null, answer_number: null, answer_bool: null },
      ];
      const analyticsMap = new Map<number, AnalyticsEntry[]>([[10, weekAnalytics]]);
      const singleQ: GoalSummary = { ...activeGoal, questions: [{ id: 10 }] };
      const report = aggregateProgress('week', [singleQ], [], analyticsMap, NOW);
      const goal = report.goals[0];
      // week: 7 entries total in period, 5 answered, 2 missed
      expect(goal.scheduled).toBe(7);
      expect(goal.answered).toBe(5);
      expect(goal.missed).toBe(2);
    });
  });
});
