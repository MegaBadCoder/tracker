import { Test, TestingModule } from '@nestjs/testing';
import { ReportService } from './report.service';
import { ReportAnswerRepositoryPort } from '../domain/report-answer-repository.port';
import { GoalService } from '../../goal/application/goal.service';
import { ScheduleService } from '../../goal/application/schedule.service';
import { StoragePort } from '../../../shared/storage/domain/storage.port';

describe('ReportService', () => {
  let service: ReportService;
  let answerRepo: Record<string, jest.Mock>;
  let goalService: Record<string, jest.Mock>;
  let scheduleService: Record<string, jest.Mock>;
  let storage: Record<string, jest.Mock>;

  beforeEach(async () => {
    answerRepo = {
      save: jest.fn().mockResolvedValue({ id: 1 }),
      findByQuestionAndDateRange: jest.fn().mockResolvedValue([]),
      findByQuestionsAndDate: jest.fn().mockResolvedValue([]),
      countByQuestionsAndDate: jest.fn().mockResolvedValue(0),
      findByQuestionAndDate: jest.fn().mockResolvedValue(null),
      findPhotosByQuestion: jest.fn().mockResolvedValue([]),
    };

    goalService = {
      findQuestionById: jest.fn(),
      findById: jest.fn(),
      findActiveByUser: jest.fn(),
    };

    scheduleService = {
      isQuestionDueOnDateHistorical: jest.fn().mockReturnValue(true),
    };

    storage = {
      upload: jest.fn().mockResolvedValue(undefined),
      getSignedReadUrl: jest
        .fn()
        .mockResolvedValue('https://example.com/signed'),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: ReportAnswerRepositoryPort, useValue: answerRepo },
        { provide: GoalService, useValue: goalService },
        { provide: ScheduleService, useValue: scheduleService },
        { provide: StoragePort, useValue: storage },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  describe('addAnswer', () => {
    const ownGoal = { id: 10, user_id: 1, goal_name: 'g' };

    it('должен сохранить ответ с normalized answer_number для типа number', async () => {
      goalService.findQuestionById.mockResolvedValue({
        id: 5,
        goal_id: 10,
        type: 'number',
      });
      goalService.findById.mockResolvedValue(ownGoal);

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
      goalService.findQuestionById.mockResolvedValue({
        id: 5,
        goal_id: 10,
        type: 'rating',
      });
      goalService.findById.mockResolvedValue(ownGoal);

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
      goalService.findQuestionById.mockResolvedValue({
        id: 5,
        goal_id: 10,
        type: 'yes_no',
      });
      goalService.findById.mockResolvedValue(ownGoal);

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

    it('должен бросить NotFoundException если вопрос не найден', async () => {
      goalService.findQuestionById.mockResolvedValue(null);

      await expect(
        service.addAnswer(1, 999, '2026-02-20', 'test'),
      ).rejects.toThrow(/not found/i);
      expect(answerRepo.save).not.toHaveBeenCalled();
    });

    it('должен бросить ForbiddenException если вопрос принадлежит другому пользователю', async () => {
      goalService.findQuestionById.mockResolvedValue({
        id: 5,
        goal_id: 10,
        type: 'number',
      });
      goalService.findById.mockResolvedValue({
        id: 10,
        user_id: 999,
        goal_name: 'other',
      });

      await expect(service.addAnswer(1, 5, '2026-02-20', '42')).rejects.toThrow(
        /forbidden/i,
      );
      expect(answerRepo.save).not.toHaveBeenCalled();
    });

    it('должен бросить NotFoundException если родительская цель не найдена', async () => {
      goalService.findQuestionById.mockResolvedValue({
        id: 5,
        goal_id: 10,
        type: 'number',
      });
      goalService.findById.mockResolvedValue(null);

      await expect(service.addAnswer(1, 5, '2026-02-20', '42')).rejects.toThrow(
        /goal not found/i,
      );
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
        questions: [{ id: 1, is_active: true, can_skip: true }],
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
      answerRepo.findByQuestionsAndDate.mockResolvedValue([{ question_id: 1 }]);

      const result = await service.getUnansweredQuestions(10, '2026-02-20');
      expect(result).toEqual([q2]);
    });

    it('должен вернуть пустой массив если все отвечены', async () => {
      goalService.findById.mockResolvedValue({
        id: 10,
        goal_start: '2026-02-17',
        questions: [{ id: 1, is_active: true, order_index: 0 }],
      });
      answerRepo.findByQuestionsAndDate.mockResolvedValue([{ question_id: 1 }]);

      const result = await service.getUnansweredQuestions(10, '2026-02-20');
      expect(result).toEqual([]);
    });
  });

  describe('addPhotoAnswer', () => {
    const ownGoal = { id: 10, user_id: 1, goal_name: 'g' };
    const photoQuestion = { id: 5, goal_id: 10, type: 'photo' };
    const photo = { buffer: Buffer.from('img'), mime: 'image/jpeg' };

    it('happy path: загружает фото и сохраняет photo_key', async () => {
      goalService.findQuestionById.mockResolvedValue(photoQuestion);
      goalService.findById.mockResolvedValue(ownGoal);
      answerRepo.findByQuestionAndDate.mockResolvedValue(null);

      await service.addPhotoAnswer(1, 5, '2026-05-22', photo);

      expect(storage.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^goal-reports\/1\/5\/2026-05-22-/),
        photo.buffer,
        photo.mime,
      );
      expect(answerRepo.save).toHaveBeenCalledWith(
        1,
        5,
        '2026-05-22',
        expect.objectContaining({
          answer_text: '',
          answer_number: null,
          answer_bool: null,
          photo_key: expect.stringMatching(/^goal-reports\/1\/5\/2026-05-22-/),
        }),
      );
    });

    it('удаляет старый S3 объект при повторной загрузке', async () => {
      goalService.findQuestionById.mockResolvedValue(photoQuestion);
      goalService.findById.mockResolvedValue(ownGoal);
      answerRepo.findByQuestionAndDate.mockResolvedValue({
        photo_key: 'goal-reports/1/5/old-key.jpg',
      });

      await service.addPhotoAnswer(1, 5, '2026-05-22', photo);

      expect(storage.delete).toHaveBeenCalledWith(
        'goal-reports/1/5/old-key.jpg',
      );
    });

    it('НЕ вызывает storage.delete когда нет существующего photo_key', async () => {
      goalService.findQuestionById.mockResolvedValue(photoQuestion);
      goalService.findById.mockResolvedValue(ownGoal);
      answerRepo.findByQuestionAndDate.mockResolvedValue(null);

      await service.addPhotoAnswer(1, 5, '2026-05-22', photo);

      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('бросает BadRequestException если type !== photo', async () => {
      goalService.findQuestionById.mockResolvedValue({
        id: 5,
        goal_id: 10,
        type: 'text',
      });
      goalService.findById.mockResolvedValue(ownGoal);

      await expect(
        service.addPhotoAnswer(1, 5, '2026-05-22', photo),
      ).rejects.toThrow(/not of type photo/i);
    });

    it('бросает BadRequestException при неподдерживаемом mime', async () => {
      goalService.findQuestionById.mockResolvedValue(photoQuestion);
      goalService.findById.mockResolvedValue(ownGoal);

      await expect(
        service.addPhotoAnswer(1, 5, '2026-05-22', {
          buffer: Buffer.from('gif'),
          mime: 'image/gif',
        }),
      ).rejects.toThrow(/unsupported image type/i);
    });

    it('бросает ForbiddenException если goal.user_id !== userId', async () => {
      goalService.findQuestionById.mockResolvedValue(photoQuestion);
      goalService.findById.mockResolvedValue({ id: 10, user_id: 999 });

      await expect(
        service.addPhotoAnswer(1, 5, '2026-05-22', photo),
      ).rejects.toThrow(/forbidden/i);
    });

    it('не падает если storage.delete бросает ошибку (best-effort)', async () => {
      goalService.findQuestionById.mockResolvedValue(photoQuestion);
      goalService.findById.mockResolvedValue(ownGoal);
      answerRepo.findByQuestionAndDate.mockResolvedValue({
        photo_key: 'goal-reports/1/5/old-key.jpg',
      });
      storage.delete.mockRejectedValue(new Error('S3 error'));

      await expect(
        service.addPhotoAnswer(1, 5, '2026-05-22', photo),
      ).resolves.toBeUndefined();
    });

    it('удаляет только что загруженный ключ если save() падает (no orphan)', async () => {
      goalService.findQuestionById.mockResolvedValue(photoQuestion);
      goalService.findById.mockResolvedValue(ownGoal);
      answerRepo.findByQuestionAndDate.mockResolvedValue(null);
      answerRepo.save.mockRejectedValue(new Error('DB locked'));

      await expect(
        service.addPhotoAnswer(1, 5, '2026-05-22', photo),
      ).rejects.toThrow(/DB locked/);

      expect(storage.upload).toHaveBeenCalledTimes(1);
      expect(storage.delete).toHaveBeenCalledTimes(1);
      const newKey = storage.upload.mock.calls[0][0] as string;
      expect(storage.delete.mock.calls[0][0]).toBe(newKey);
    });

    it('НЕ удаляет старый ключ если save() падает (старая фото остаётся доступной)', async () => {
      goalService.findQuestionById.mockResolvedValue(photoQuestion);
      goalService.findById.mockResolvedValue(ownGoal);
      const oldKey = 'goal-reports/1/5/old.jpg';
      answerRepo.findByQuestionAndDate.mockResolvedValue({ photo_key: oldKey });
      answerRepo.save.mockRejectedValue(new Error('DB locked'));

      await expect(
        service.addPhotoAnswer(1, 5, '2026-05-22', photo),
      ).rejects.toThrow(/DB locked/);

      const deleteCalls = storage.delete.mock.calls.map((c: unknown[]) => c[0]);
      expect(deleteCalls).not.toContain(oldKey);
    });
  });

  describe('getGoalReportStatus', () => {
    const ownGoal = {
      id: 10,
      user_id: 1,
      goal_start: '2026-02-17',
      goal_end: '2026-05-01',
      questions: [
        {
          id: 1,
          is_active: true,
          can_skip: false,
          order_index: 1,
          question: 'Q1',
          type: 'number',
          target_value: '30',
        },
        {
          id: 2,
          is_active: true,
          can_skip: true,
          order_index: 0,
          question: 'Q2',
          type: 'text',
          target_value: null,
        },
      ],
    };

    it('помечает answered корректно и сортирует по order_index', async () => {
      goalService.findById.mockResolvedValue(ownGoal);
      scheduleService.isQuestionDueOnDateHistorical.mockReturnValue(true);
      answerRepo.findByQuestionsAndDate.mockResolvedValue([
        {
          question_id: 2,
          answer_text: 'hello',
          answer_number: null,
          answer_bool: null,
        },
      ]);
      answerRepo.countByQuestionsAndDate.mockResolvedValue(0);

      const result = await service.getGoalReportStatus(1, 10, '2026-02-20');

      expect(result.goalId).toBe(10);
      expect(result.date).toBe('2026-02-20');
      // отсортировано по order_index: q2 (0), затем q1 (1)
      expect(result.questions.map((q) => q.questionId)).toEqual([2, 1]);

      const q2 = result.questions.find((q) => q.questionId === 2)!;
      expect(q2.answered).toBe(true);
      expect(q2.answer_text).toBe('hello');

      const q1 = result.questions.find((q) => q.questionId === 1)!;
      expect(q1.answered).toBe(false);
      expect(q1.answer_text).toBeNull();
      expect(q1.target_value).toBe('30');
    });

    it('allDone=true только когда все !can_skip due-вопросы отвечены', async () => {
      goalService.findById.mockResolvedValue(ownGoal);
      scheduleService.isQuestionDueOnDateHistorical.mockReturnValue(true);
      // q1 (обязательный) отвечен, q2 (можно пропустить) не отвечен
      answerRepo.findByQuestionsAndDate.mockResolvedValue([
        {
          question_id: 1,
          answer_text: '42',
          answer_number: 42,
          answer_bool: null,
        },
      ]);

      const result = await service.getGoalReportStatus(1, 10, '2026-02-20');
      expect(result.allDone).toBe(true);
    });

    it('allDone=false когда обязательный due-вопрос не отвечен', async () => {
      goalService.findById.mockResolvedValue(ownGoal);
      scheduleService.isQuestionDueOnDateHistorical.mockReturnValue(true);
      answerRepo.findByQuestionsAndDate.mockResolvedValue([
        {
          question_id: 2,
          answer_text: 'hi',
          answer_number: null,
          answer_bool: null,
        },
      ]);

      const result = await service.getGoalReportStatus(1, 10, '2026-02-20');
      expect(result.allDone).toBe(false);
    });

    it('бросает Forbidden если цель не принадлежит пользователю', async () => {
      goalService.findById.mockResolvedValue({ ...ownGoal, user_id: 999 });

      await expect(
        service.getGoalReportStatus(1, 10, '2026-02-20'),
      ).rejects.toThrow(/forbidden/i);
    });

    it('бросает NotFound если цель не найдена', async () => {
      goalService.findById.mockResolvedValue(null);

      await expect(
        service.getGoalReportStatus(1, 10, '2026-02-20'),
      ).rejects.toThrow(/not found/i);
    });

    it('не включает вопрос, который не due на дату', async () => {
      goalService.findById.mockResolvedValue(ownGoal);
      // q1 due, q2 не due
      scheduleService.isQuestionDueOnDateHistorical.mockImplementation(
        (q: { id: number }) => q.id === 1,
      );
      answerRepo.findByQuestionsAndDate.mockResolvedValue([]);

      const result = await service.getGoalReportStatus(1, 10, '2026-02-20');
      expect(result.questions.map((q) => q.questionId)).toEqual([1]);
    });
  });

  describe('getReportQueue', () => {
    it('включает только цели с unanswered due и считает pendingCount', async () => {
      const goalA = { id: 10, user_id: 1, goal_start: '2026-02-17' };
      const goalB = { id: 20, user_id: 1, goal_start: '2026-02-17' };
      goalService.findActiveByUser.mockResolvedValue([goalA, goalB]);

      const getUnanswered = jest
        .spyOn(service, 'getUnansweredQuestions')
        .mockImplementation((goalId: number) => {
          if (goalId === 10)
            return Promise.resolve([{ id: 1 }, { id: 2 }] as never);
          return Promise.resolve([] as never);
        });

      // goalName берётся из имени цели
      (goalA as Record<string, unknown>).goal_name = 'Goal A';
      (goalB as Record<string, unknown>).goal_name = 'Goal B';

      const result = await service.getReportQueue(1, '2026-02-20');

      expect(getUnanswered).toHaveBeenCalledWith(10, '2026-02-20');
      expect(getUnanswered).toHaveBeenCalledWith(20, '2026-02-20');
      expect(result).toEqual([
        { goalId: 10, goalName: 'Goal A', pendingCount: 2 },
      ]);
    });

    it('возвращает пустой список когда всё заполнено', async () => {
      const goalA = { id: 10, user_id: 1, goal_name: 'A' };
      goalService.findActiveByUser.mockResolvedValue([goalA]);
      jest
        .spyOn(service, 'getUnansweredQuestions')
        .mockResolvedValue([] as never);

      const result = await service.getReportQueue(1, '2026-02-20');
      expect(result).toEqual([]);
    });
  });

  describe('getPhotoGallery', () => {
    const ownGoal = { id: 10, user_id: 1 };
    const photoQuestion = { id: 5, goal_id: 10, type: 'photo' };

    it('возвращает массив с presigned URL в том же порядке', async () => {
      goalService.findQuestionById.mockResolvedValue(photoQuestion);
      goalService.findById.mockResolvedValue(ownGoal);
      answerRepo.findPhotosByQuestion.mockResolvedValue([
        { scheduled_date: '2026-05-22', photo_key: 'key1.jpg' },
        { scheduled_date: '2026-05-21', photo_key: 'key2.jpg' },
      ]);
      storage.getSignedReadUrl
        .mockResolvedValueOnce('https://s3.example.com/key1')
        .mockResolvedValueOnce('https://s3.example.com/key2');

      const result = await service.getPhotoGallery(1, 5, 50, 0);

      expect(result).toEqual([
        { scheduled_date: '2026-05-22', url: 'https://s3.example.com/key1' },
        { scheduled_date: '2026-05-21', url: 'https://s3.example.com/key2' },
      ]);
      expect(storage.getSignedReadUrl).toHaveBeenCalledWith('key1.jpg', 3600);
      expect(storage.getSignedReadUrl).toHaveBeenCalledWith('key2.jpg', 3600);
    });

    it('бросает BadRequestException если type !== photo', async () => {
      goalService.findQuestionById.mockResolvedValue({
        id: 5,
        goal_id: 10,
        type: 'text',
      });
      goalService.findById.mockResolvedValue(ownGoal);

      await expect(service.getPhotoGallery(1, 5, 50, 0)).rejects.toThrow(
        /not of type photo/i,
      );
    });

    it('бросает ForbiddenException если goal.user_id !== userId', async () => {
      goalService.findQuestionById.mockResolvedValue(photoQuestion);
      goalService.findById.mockResolvedValue({ id: 10, user_id: 999 });

      await expect(service.getPhotoGallery(1, 5, 50, 0)).rejects.toThrow(
        /forbidden/i,
      );
    });

    it('возвращает пустой массив если нет фото', async () => {
      goalService.findQuestionById.mockResolvedValue(photoQuestion);
      goalService.findById.mockResolvedValue(ownGoal);
      answerRepo.findPhotosByQuestion.mockResolvedValue([]);

      const result = await service.getPhotoGallery(1, 5, 50, 0);
      expect(result).toEqual([]);
    });
  });
});
