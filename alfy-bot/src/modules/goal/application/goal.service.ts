import { Injectable, NotFoundException } from '@nestjs/common';
import { GoalStatus } from '../../../shared/constants/goal-statuses';
import { Goal, Question, Schedule } from '../../../shared/entities';
import { GoalRepositoryPort } from '../domain/goal-repository.port';
import {
  ScheduleData,
  ScheduleRepositoryPort,
} from '../domain/schedule-repository.port';

/** Форматирует Date в 'YYYY-MM-DD' по локальному времени */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface QuestionWithSchedule {
  question: string;
  type: string;
  canSkip: boolean;
  scheduleType: string;
  selectedDays?: number[];
  intervalDays?: number;
}

@Injectable()
export class GoalService {
  constructor(
    private goalRepo: GoalRepositoryPort,
    private scheduleRepo: ScheduleRepositoryPort,
  ) { }

  async create(
    userId: number,
    goalData:
      | Partial<Goal>
      | {
          goal_name: string;
          goal_start: string;
          goal_end: string;
          questions?: Array<{
            question: string;
            type: string;
            canSkip: boolean;
          }>;
        },
  ): Promise<Goal> {
    return this.goalRepo.create(userId, goalData);
  }

  async findByUser(userId: number): Promise<Goal[]> {
    return this.goalRepo.findByUser(userId);
  }

  async findActiveByUser(userId: number): Promise<Goal[]> {
    return this.goalRepo.findActiveByUser(userId);
  }

  async findByStatus(userId: number, status: GoalStatus): Promise<Goal[]> {
    return this.goalRepo.findByStatus(userId, status);
  }

  async findAllByUser(userId: number): Promise<Goal[]> {
    return this.goalRepo.findAllByUser(userId);
  }

  async findById(goalId: number): Promise<Goal | null> {
    return this.goalRepo.findById(goalId);
  }

  async addQuestions(
    goalId: number,
    questions: Array<{ question: string; type: string; canSkip: boolean }>,
  ): Promise<Question[]> {
    return this.goalRepo.addQuestions(goalId, questions);
  }

  async addQuestionsWithSchedules(
    goalId: number,
    questions: QuestionWithSchedule[],
  ): Promise<Question[]> {
    const goal = await this.goalRepo.findById(goalId);
    const effectiveFrom = goal?.goal_start ?? todayISO();

    const questionsData = questions.map((q) => ({
      question: q.question,
      type: q.type,
      canSkip: q.canSkip,
    }));
    const savedQuestions = await this.goalRepo.addQuestions(
      goalId,
      questionsData,
    );

    for (let i = 0; i < savedQuestions.length; i++) {
      const q = questions[i];
      await this.scheduleRepo.create(savedQuestions[i].id, {
        frequency_type: q.scheduleType,
        days_of_week: q.selectedDays,
        interval_days: q.intervalDays,
        effective_from: effectiveFrom,
      });
    }

    return savedQuestions;
  }

  async update(goalId: number, updates: Partial<Goal>): Promise<Goal> {
    return this.goalRepo.update(goalId, updates);
  }

  async updateGoalStatus(goalId: number, status: GoalStatus): Promise<void> {
    return this.goalRepo.updateGoalStatus(goalId, status);
  }

  async findQuestionById(questionId: number) {
    return this.goalRepo.findQuestionById(questionId);
  }

  async updateQuestionSchedule(
    questionId: number,
    data: ScheduleData,
  ): Promise<Schedule> {
    const question = await this.goalRepo.findQuestionById(questionId);
    if (!question) {
      throw new NotFoundException(
        `Question #${questionId} not found`,
      );
    }
    return this.scheduleRepo.createNewVersion(questionId, {
      ...data,
      effective_from: todayISO(),
    });
  }
}
