import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Question, Schedule } from '../../../shared/entities';
import { QuestionRepositoryPort } from '../domain/question-repository.port';
import {
  ScheduleData,
  ScheduleRepositoryPort,
} from '../../goal/domain/schedule-repository.port';
import { ScheduleService } from '../../goal/application/schedule.service';
import { ReportAnswerRepositoryPort } from '../../report/domain/report-answer-repository.port';
import { HabitWithHistoryDto, HabitDayStatus } from '../dto/habit-response.dto';

/** Форматирует Date в 'YYYY-MM-DD' по локальному времени */
function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayISO(): string {
  return toLocalISO(new Date());
}

@Injectable()
export class QuestionService {
  constructor(
    private questionRepo: QuestionRepositoryPort,
    private scheduleRepo: ScheduleRepositoryPort,
    private scheduleService: ScheduleService,
    private answerRepo: ReportAnswerRepositoryPort,
  ) {}

  async getHabits(userId: number): Promise<Question[]> {
    return this.questionRepo.findHabitsByUser(userId);
  }

  async getHabitsWithHistory(
    userId: number,
    days: number,
  ): Promise<HabitWithHistoryDto[]> {
    const habits = await this.questionRepo.findHabitsByUser(userId);
    if (habits.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDay = new Date(today);
    startDay.setDate(startDay.getDate() - days + 1);

    const startDate = toLocalISO(startDay);
    const endDate = toLocalISO(today);

    const questionIds = habits.map((q) => q.id);
    const answers = await this.answerRepo.findByQuestionsAndDateRange(
      questionIds,
      startDate,
      endDate,
    );

    // Map: questionId -> Set of answered dates
    const answeredMap = new Map<number, Set<string>>();
    for (const a of answers) {
      if (!answeredMap.has(a.question_id)) {
        answeredMap.set(a.question_id, new Set());
      }
      answeredMap.get(a.question_id)!.add(a.scheduled_date);
    }

    return habits.map((habit) => {
      const createdAt = new Date(habit.createdAt);
      createdAt.setHours(0, 0, 0, 0);
      const answered = answeredMap.get(habit.id) ?? new Set<string>();

      const history: { date: string; status: HabitDayStatus }[] = [];
      const cursor = new Date(startDay);

      while (cursor <= today) {
        if (cursor >= createdAt) {
          const dateStr = toLocalISO(cursor);
          const isDue = this.scheduleService.isQuestionDueOnDateHistorical(
            habit,
            cursor,
          );

          if (!isDue) {
            history.push({ date: dateStr, status: 'not_due' });
          } else if (answered.has(dateStr)) {
            history.push({ date: dateStr, status: 'filled' });
          } else {
            history.push({ date: dateStr, status: 'not_filled' });
          }
        }

        cursor.setDate(cursor.getDate() + 1);
      }

      return {
        id: habit.id,
        question: habit.question,
        type: habit.type,
        can_skip: habit.can_skip,
        is_active: habit.is_active,
        target_value: habit.target_value,
        createdAt: habit.createdAt,
        history,
      };
    });
  }

  async createHabit(
    userId: number,
    data: {
      question: string;
      type: string;
      can_skip?: boolean;
      target_value?: string;
      frequency_type?: string;
      days_of_week?: number[];
      interval_days?: number;
    },
  ): Promise<Question> {
    const question = await this.questionRepo.create(userId, {
      question: data.question,
      type: data.type,
      can_skip: data.can_skip ?? false,
      target_value: data.target_value ?? null,
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

  async findById(id: number, userId: number): Promise<Question> {
    return this.assertOwnership(id, userId);
  }

  async updateQuestion(
    id: number,
    userId: number,
    data: Partial<
      Pick<
        Question,
        'question' | 'type' | 'can_skip' | 'is_habit' | 'target_value'
      >
    >,
  ): Promise<Question> {
    const question = await this.assertOwnership(id, userId);

    // Validate target_value for number type
    if (data.target_value !== undefined) {
      const effectiveType = data.type ?? question.type;
      if (
        effectiveType === 'number' &&
        data.target_value !== null &&
        isNaN(Number(data.target_value))
      ) {
        throw new BadRequestException(
          'target_value must be a valid number for number-type questions',
        );
      }
    }

    // Backfill user_id when converting a goal question to a habit
    if (data.is_habit === true && !question.user_id && question.goal?.user_id) {
      await this.questionRepo.update(question.id, {
        user_id: question.goal.user_id,
      } as any);
    }

    return this.questionRepo.update(question.id, data);
  }

  async toggleHabit(id: number, userId: number): Promise<Question> {
    const question = await this.assertOwnership(id, userId);
    return this.questionRepo.update(question.id, {
      is_habit: !question.is_habit,
    });
  }

  async updateSchedule(
    questionId: number,
    userId: number,
    data: ScheduleData,
  ): Promise<Schedule> {
    await this.assertOwnership(questionId, userId);
    return this.scheduleRepo.createNewVersion(questionId, {
      ...data,
      effective_from: todayISO(),
    });
  }

  async deactivate(id: number, userId: number): Promise<void> {
    await this.assertOwnership(id, userId);
    await this.questionRepo.deactivate(id);
  }

  async countAnswers(id: number, userId: number): Promise<number> {
    await this.assertOwnership(id, userId);
    return this.answerRepo.countByQuestion(id);
  }

  private async assertOwnership(id: number, userId: number): Promise<Question> {
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
