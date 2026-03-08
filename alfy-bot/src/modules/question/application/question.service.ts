import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Question } from '../../../shared/entities';
import { QuestionRepositoryPort } from '../domain/question-repository.port';
import {
  ScheduleData,
  ScheduleRepositoryPort,
} from '../../goal/domain/schedule-repository.port';

/** Форматирует Date в 'YYYY-MM-DD' по локальному времени */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Injectable()
export class QuestionService {
  constructor(
    private questionRepo: QuestionRepositoryPort,
    private scheduleRepo: ScheduleRepositoryPort,
  ) {}

  async getHabits(userId: number): Promise<Question[]> {
    return this.questionRepo.findHabitsByUser(userId);
  }

  async createHabit(
    userId: number,
    data: {
      question: string;
      type: string;
      can_skip?: boolean;
      frequency_type?: string;
      days_of_week?: number[];
      interval_days?: number;
    },
  ): Promise<Question> {
    const question = await this.questionRepo.create(userId, {
      question: data.question,
      type: data.type,
      can_skip: data.can_skip ?? false,
      is_habit: true,
      is_active: true,
      goal_id: null,
    });

    if (data.frequency_type) {
      await this.scheduleRepo.create(question.id, {
        frequency_type: data.frequency_type,
        days_of_week: data.days_of_week,
        interval_days: data.interval_days,
        effective_from: todayISO(),
      });
    }

    return question;
  }

  async updateQuestion(
    id: number,
    userId: number,
    data: Partial<Pick<Question, 'question' | 'type' | 'can_skip' | 'is_habit'>>,
  ): Promise<Question> {
    const question = await this.assertOwnership(id, userId);
    return this.questionRepo.update(question.id, data);
  }

  async toggleHabit(id: number, userId: number): Promise<Question> {
    const question = await this.assertOwnership(id, userId);
    return this.questionRepo.update(question.id, {
      is_habit: !question.is_habit,
    });
  }

  async deactivate(id: number, userId: number): Promise<void> {
    await this.assertOwnership(id, userId);
    await this.questionRepo.deactivate(id);
  }

  private async assertOwnership(
    id: number,
    userId: number,
  ): Promise<Question> {
    const question = await this.questionRepo.findById(id);
    if (!question) {
      throw new NotFoundException(`Question #${id} not found`);
    }

    const ownerUserId = question.goal?.user_id ?? question.user_id;
    if (ownerUserId !== userId) {
      throw new ForbiddenException();
    }

    return question;
  }
}
