import { Goal, Question } from '../../../shared/entities';

export interface QuestionData {
  question: string;
  type: string;
  canSkip: boolean;
  scheduleType?: string;
  selectedDays?: number[];
  intervalDays?: number;
}

export abstract class GoalRepositoryPort {
  abstract create(
    userId: number,
    goalData:
      | Partial<Goal>
      | {
          goal_name: string;
          goal_start: string;
          goal_end: string;
          questions?: QuestionData[];
        },
  ): Promise<Goal>;
  abstract findByUser(userId: number): Promise<Goal[]>;
  abstract findActiveByUser(userId: number): Promise<Goal[]>;
  abstract findAllByUser(userId: number): Promise<Goal[]>;
  abstract findByStatus(userId: number, status: string): Promise<Goal[]>;
  abstract findById(goalId: number): Promise<Goal | null>;
  abstract update(goalId: number, updates: Partial<Goal>): Promise<Goal>;
  abstract updateGoalStatus(goalId: number, status: string): Promise<void>;
  abstract addQuestions(
    goalId: number,
    questions: Array<{ question: string; type: string; canSkip: boolean }>,
  ): Promise<Question[]>;
  abstract findQuestionById(questionId: number): Promise<Question | null>;
}
