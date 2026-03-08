import { Test, TestingModule } from '@nestjs/testing';
import { ReportService } from './report.service';
import { ReportAnswerRepositoryPort } from '../domain/report-answer-repository.port';
import { GoalService } from '../../goal/application/goal.service';
import { ScheduleService } from '../../goal/application/schedule.service';

describe('ReportService', () => {
  let service: ReportService;
  let answerRepo: Record<string, jest.Mock>;
  let goalService: Record<string, jest.Mock>;
  let scheduleService: Record<string, jest.Mock>;

  beforeEach(async () => {
    answerRepo = {
      save: jest.fn().mockResolvedValue({ id: 1 }),
      findByQuestionAndDateRange: jest.fn().mockResolvedValue([]),
      findByQuestionsAndDate: jest.fn().mockResolvedValue([]),
      countByQuestionsAndDate: jest.fn().mockResolvedValue(0),
    };

    goalService = {
      findQuestionById: jest.fn(),
      findById: jest.fn(),
    };

    scheduleService = {
      isQuestionDueOnDateHistorical: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: ReportAnswerRepositoryPort, useValue: answerRepo },
        { provide: GoalService, useValue: goalService },
        { provide: ScheduleService, useValue: scheduleService },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  describe('addAnswer', () => {
    it('должен сохранить ответ с normalized answer_number для типа number', async () => {
      goalService.findQuestionById.mockResolvedValue({ id: 5, type: 'number' });

      await service.addAnswer(1, 5, '2026-02-20', '42');

      expect(answerRepo.save).toHaveBeenCalledWith(
        1,
        5,
        '2026-02-20',
        expect.objectContaining({
          answer_text: '42',
          answer_number: 42,
          answer_bool: null,
        }),
      );
    });

    it('должен нормализовать answer_number для типа rating с запятой', async () => {
      goalService.findQuestionById.mockResolvedValue({ id: 5, type: 'rating' });

      await service.addAnswer(1, 5, '2026-02-20', '4,5');

      expect(answerRepo.save).toHaveBeenCalledWith(
        1,
        5,
        '2026-02-20',
        expect.objectContaining({
          answer_number: 4.5,
          answer_bool: null,
        }),
      );
    });

    it('должен нормализовать answer_bool для yes_no — "да"', async () => {
      goalService.findQuestionById.mockResolvedValue({ id: 5, type: 'yes_no' });

      await service.addAnswer(1, 5, '2026-02-20', 'Да');

      expect(answerRepo.save).toHaveBeenCalledWith(
        1,
        5,
        '2026-02-20',
        expect.objectContaining({
          answer_bool: true,
        }),
      );
    });

    it('должен бросить ошибку если вопрос не найден', async () => {
      goalService.findQuestionById.mockResolvedValue(null);

      await expect(
        service.addAnswer(1, 999, '2026-02-20', 'test'),
      ).rejects.toThrow('Question not found');
      expect(answerRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('isDateFilled', () => {
    it('должен вернуть true когда все обязательные вопросы отвечены', async () => {
      goalService.findById.mockResolvedValue({
        id: 10,
        goal_start: '2026-02-17',
        questions: [
          { id: 1, is_active: true, can_skip: false },
          { id: 2, is_active: true, can_skip: true },
        ],
      });
      answerRepo.countByQuestionsAndDate.mockResolvedValue(1);

      const result = await service.isDateFilled(10, '2026-02-20');
      expect(result).toBe(true);
    });

    it('должен вернуть false когда есть неотвеченные обязательные', async () => {
      goalService.findById.mockResolvedValue({
        id: 10,
        goal_start: '2026-02-17',
        questions: [
          { id: 1, is_active: true, can_skip: false },
          { id: 2, is_active: true, can_skip: false },
        ],
      });
      answerRepo.countByQuestionsAndDate.mockResolvedValue(1);

      const result = await service.isDateFilled(10, '2026-02-20');
      expect(result).toBe(false);
    });

    it('должен вернуть true если нет обязательных вопросов', async () => {
      goalService.findById.mockResolvedValue({
        id: 10,
        goal_start: '2026-02-17',
        questions: [
          { id: 1, is_active: true, can_skip: true },
        ],
      });

      const result = await service.isDateFilled(10, '2026-02-20');
      expect(result).toBe(true);
    });
  });

  describe('getUnansweredQuestions', () => {
    it('должен вернуть вопросы без ответов на дату', async () => {
      const q1 = { id: 1, is_active: true, order_index: 0 };
      const q2 = { id: 2, is_active: true, order_index: 1 };

      goalService.findById.mockResolvedValue({
        id: 10,
        goal_start: '2026-02-17',
        questions: [q1, q2],
      });
      answerRepo.findByQuestionsAndDate.mockResolvedValue([
        { question_id: 1 },
      ]);

      const result = await service.getUnansweredQuestions(10, '2026-02-20');
      expect(result).toEqual([q2]);
    });

    it('должен вернуть пустой массив если все отвечены', async () => {
      goalService.findById.mockResolvedValue({
        id: 10,
        goal_start: '2026-02-17',
        questions: [{ id: 1, is_active: true, order_index: 0 }],
      });
      answerRepo.findByQuestionsAndDate.mockResolvedValue([
        { question_id: 1 },
      ]);

      const result = await service.getUnansweredQuestions(10, '2026-02-20');
      expect(result).toEqual([]);
    });
  });
});
