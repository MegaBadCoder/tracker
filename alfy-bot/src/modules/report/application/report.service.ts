import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Goal, Question } from '../../../shared/entities';
import { GoalService } from '../../goal/application/goal.service';
import { ScheduleService } from '../../goal/application/schedule.service';
import { ReportAnswerRepositoryPort } from '../domain/report-answer-repository.port';
import { AnalyticsEntryDto } from '../dto/question-analytics.dto';

const NUMERIC_TYPES = new Set(['number', 'rating']);
const NOT_FILLED_TEXT = 'Не было заполнено';

/** Форматирует Date в 'YYYY-MM-DD' по локальному времени (без UTC-сдвига) */
function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Injectable()
export class ReportService {
  constructor(
    private answerRepo: ReportAnswerRepositoryPort,
    private goalService: GoalService,
    private scheduleService: ScheduleService,
  ) { }

  async addAnswer(
    userId: number,
    questionId: number,
    scheduledDate: string,
    answerText: string,
  ): Promise<void> {
    const question = await this.goalService.findQuestionById(questionId);
    if (!question) throw new Error('Question not found');

    const normalized = this.normalizeAnswer(answerText, question.type);

    await this.answerRepo.save(userId, questionId, scheduledDate, {
      answer_text: answerText,
      answer_number: normalized.answer_number,
      answer_bool: normalized.answer_bool,
    });
  }

  private normalizeAnswer(
    answer: string,
    type: string,
  ): { answer_number: number | null; answer_bool: boolean | null } {
    const trimmed = answer.trim();
    const lower = trimmed.toLowerCase();

    let answer_number: number | null = null;
    let answer_bool: boolean | null = null;

    if (type === 'number' || type === 'rating') {
      const n = Number(trimmed.replace(',', '.'));
      if (!isNaN(n)) answer_number = n;
    }

    if (type === 'yes_no') {
      if (['да', 'yes', 'true', '1'].includes(lower)) answer_bool = true;
      if (['нет', 'no', 'false', '0'].includes(lower)) answer_bool = false;
    }

    return { answer_number, answer_bool };
  }

  /**
   * Проверяет, заполнены ли все обязательные due-вопросы на дату.
   * Принимает опциональный goal, чтобы не делать лишний запрос.
   */
  async isDateFilled(goalId: number, date: string, preloadedGoal?: Goal): Promise<boolean> {
    const goal = preloadedGoal ?? await this.goalService.findById(goalId);
    if (!goal) return false;

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const dueQuestions = goal.questions
      .filter((q) => q.is_active && !q.can_skip)
      .filter((q) =>
        this.scheduleService.isQuestionDueOnDateHistorical(q, targetDate),
      );

    if (dueQuestions.length === 0) return true;

    const answered = await this.answerRepo.countByQuestionsAndDate(
      dueQuestions.map((q) => q.id),
      date,
    );

    return answered >= dueQuestions.length;
  }

  /**
   * Возвращает вопросы, на которые ещё нет ответов на указанную дату
   */
  async getUnansweredQuestions(
    goalId: number,
    date: string,
  ): Promise<Question[]> {
    const goal = await this.goalService.findById(goalId);
    if (!goal) return [];

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const dueQuestions = goal.questions
      .filter((q) => q.is_active)
      .filter((q) =>
        this.scheduleService.isQuestionDueOnDateHistorical(q, targetDate),
      )
      .sort((a, b) => a.order_index - b.order_index);

    if (dueQuestions.length === 0) return [];

    const existing = await this.answerRepo.findByQuestionsAndDate(
      dueQuestions.map((q) => q.id),
      date,
    );
    const answeredIds = new Set(existing.map((a) => a.question_id));

    return dueQuestions.filter((q) => !answeredIds.has(q.id));
  }

  /**
   * Находит последнюю незаполненную дату по расписанию (до сегодня).
   * Возвращает null если всё заполнено.
   */
  async findLastUnfilledDate(goalId: number): Promise<string | null> {
    const goal = await this.goalService.findById(goalId);
    if (!goal) return null;

    const activeQuestions = (goal.questions || []).filter((q) => q.is_active);
    if (activeQuestions.length === 0) return null;

    const start = new Date(goal.goal_start);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (yesterday < start) return null;

    const endDate = new Date(goal.goal_end);
    endDate.setHours(0, 0, 0, 0);
    const limit = yesterday < endDate ? yesterday : endDate;

    const cursor = new Date(limit);
    const MAX_LOOKBACK_DAYS = 30;
    let daysChecked = 0;

    while (cursor >= start && daysChecked < MAX_LOOKBACK_DAYS) {
      const hasAnyDue = activeQuestions.some((q) =>
        this.scheduleService.isQuestionDueOnDateHistorical(q, cursor),
      );

      if (hasAnyDue) {
        const dateStr = toLocalISO(cursor);
        const dueQuestions = activeQuestions
          .filter((q) => !q.can_skip)
          .filter((q) =>
            this.scheduleService.isQuestionDueOnDateHistorical(q, cursor),
          );

        if (dueQuestions.length === 0) return null;

        const answered = await this.answerRepo.countByQuestionsAndDate(
          dueQuestions.map((q) => q.id),
          dateStr,
        );

        if (answered < dueQuestions.length) {
          return dateStr;
        }
        return null;
      }

      cursor.setDate(cursor.getDate() - 1);
      daysChecked++;
    }

    return null;
  }

  async getQuestionAnalytics(
    questionId: number,
    dbUserId: number,
  ): Promise<AnalyticsEntryDto[]> {
    // 1. Загружаем вопрос и его цель, проверяем доступ
    const question = await this.goalService.findQuestionById(questionId);
    if (!question)
      throw new NotFoundException(`Question #${questionId} not found`);

    const goal = await this.goalService.findById(question.goal_id!);
    if (!goal) throw new NotFoundException('Goal not found');
    if (goal.user_id !== dbUserId) throw new ForbiddenException();

    // 2. Определяем диапазон дат: от старта цели до min(конец цели, сегодня)
    //    Не показываем будущие даты — по ним ещё нет данных
    const startDate = goal.goal_start;
    const endGoal = new Date(goal.goal_end);
    endGoal.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = toLocalISO(endGoal < today ? endGoal : today);

    // 3. Одним запросом достаём все ответы на этот вопрос за весь диапазон
    const answers = await this.answerRepo.findByQuestionAndDateRange(
      questionId,
      startDate,
      endDate,
    );

    // 4. Строим Map<дата, ответ> для O(1) поиска при итерации по расписанию
    const answerByDate = new Map(answers.map((a) => [a.scheduled_date, a]));

    // 5. Итерируем день за днём от start до end
    //    На каждую дату резолвим правильное расписание из истории
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const sortedSchedules = [...(question.schedules || [])].sort((a, b) =>
      (a.effective_from ?? '').localeCompare(b.effective_from ?? ''),
    );

    const result: AnalyticsEntryDto[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      const schedule = this.scheduleService.getScheduleForDate(
        sortedSchedules,
        cursor,
      );

      const isDue = schedule
        ? this.scheduleService.isScheduleDueOnDate(
          schedule,
          toLocalISO(question.createdAt),
          cursor,
        )
        : true;

      if (isDue) {
        const dateKey = toLocalISO(cursor);
        const answer = answerByDate.get(dateKey);

        if (answer) {
          result.push({
            date: dateKey,
            answer_text: answer.answer_text,
            answer_number: answer.answer_number,
            answer_bool: answer.answer_bool,
            filled: true,
          });
        } else {
          result.push({
            date: dateKey,
            answer_text: NUMERIC_TYPES.has(question.type)
              ? null
              : NOT_FILLED_TEXT,
            answer_number: NUMERIC_TYPES.has(question.type) ? 0 : null,
            answer_bool: null,
            filled: false,
          });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }
}
