import { Test, TestingModule } from '@nestjs/testing';
import { GoalService } from '../../goal/application/goal.service';
import { ScheduleService } from '../../goal/application/schedule.service';
import { ReportService } from '../../report/application/report.service';
import { AuthService } from '../../auth/auth.service';
import { ReportScene } from './report.scene';

function makeQuestion(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    question: 'Как дела?',
    type: 'text',
    can_skip: false,
    is_active: true,
    order_index: 0,
    schedule: null,
    ...overrides,
  };
}

function makeGoal(overrides: Record<string, any> = {}) {
  return {
    id: 10,
    goal_name: 'Тестовая цель',
    goal_start: '2026-01-01',
    goal_end: '2026-12-31',
    status: 'active',
    questions: [makeQuestion()],
    ...overrides,
  };
}

function makeCtx(sessionOverrides: Record<string, any> = {}) {
  return {
    reply: jest.fn().mockResolvedValue({ message_id: 100 }),
    editMessageText: jest.fn().mockResolvedValue(true),
    answerCbQuery: jest.fn().mockResolvedValue(true),
    deleteMessage: jest.fn().mockResolvedValue(true),
    scene: { leave: jest.fn().mockResolvedValue(true) },
    session: { ...sessionOverrides },
    from: { id: 456 },
    message: null,
    match: null,
    chat: { id: 789 },
    telegram: {
      editMessageText: jest.fn().mockResolvedValue(true),
      getFileLink: jest.fn().mockResolvedValue({ toString: () => 'https://tg/file' }),
    },
  } as any;
}

describe('ReportScene', () => {
  let scene: ReportScene;
  let goalService: Record<string, jest.Mock>;
  let reportService: Record<string, jest.Mock>;
  let authService: Record<string, jest.Mock>;
  let scheduleService: Record<string, jest.Mock>;

  beforeEach(async () => {
    goalService = {
      findActiveByUser: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
    };

    reportService = {
      addAnswer: jest.fn().mockResolvedValue(undefined),
      addPhotoAnswer: jest.fn().mockResolvedValue(undefined),
      isDateFilled: jest.fn().mockResolvedValue(false),
      getUnansweredQuestions: jest.fn().mockResolvedValue([]),
      findLastUnfilledDate: jest.fn().mockResolvedValue(null),
    };

    authService = {
      findOrCreateTelegramUser: jest.fn().mockResolvedValue({ id: 1 }),
    };

    scheduleService = {
      hasAnyQuestionDueToday: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportScene,
        { provide: GoalService, useValue: goalService },
        { provide: ReportService, useValue: reportService },
        { provide: AuthService, useValue: authService },
        { provide: ScheduleService, useValue: scheduleService },
      ],
    }).compile();

    scene = module.get<ReportScene>(ReportScene);
  });

  describe('onEnter', () => {
    it('должен показать список доступных целей', async () => {
      const goal = makeGoal();
      goalService.findActiveByUser.mockResolvedValue([goal]);
      const ctx = makeCtx();

      await scene.onEnter(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Твои цели'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ callback_data: 'no_more' }),
              ]),
            ]),
          }),
        }),
      );
      expect(ctx.session.availableGoals).toEqual([goal]);
    });

    it('должен показать "все цели закрыты" если нет доступных', async () => {
      goalService.findActiveByUser.mockResolvedValue([]);
      const ctx = makeCtx();

      await scene.onEnter(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('уже есть отчет'),
      );
      expect(ctx.scene.leave).toHaveBeenCalled();
    });

    it('должен пропустить цель с заполненным отчётом', async () => {
      const goal = makeGoal();
      goalService.findActiveByUser.mockResolvedValue([goal]);
      reportService.isDateFilled.mockResolvedValue(true);
      const ctx = makeCtx();

      await scene.onEnter(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('уже есть отчет'),
      );
    });
  });

  describe('text goal selection + startReport', () => {
    it('должен запросить неотвеченные вопросы и задать первый', async () => {
      const goal = makeGoal({ id: 10 });
      const q1 = makeQuestion({ id: 10, question: 'Вопрос 1' });
      goalService.findById.mockResolvedValue(makeGoal({ questions: [q1] }));
      reportService.getUnansweredQuestions.mockResolvedValue([q1]);

      const ctx = makeCtx({ availableGoals: [goal] });
      ctx.message = { text: '1', message_id: 200 };

      await scene.handleTextAnswer(ctx);

      expect(ctx.session.targetDate).toBeDefined();
      expect(ctx.session.questions).toEqual([q1]);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Вопрос 1'),
        expect.objectContaining({ reply_markup: expect.any(Object) }),
      );
    });

    it('должен показать "все отвечены" если нет неотвеченных', async () => {
      const goal = makeGoal({ id: 10 });
      goalService.findById.mockResolvedValue(makeGoal());
      reportService.getUnansweredQuestions.mockResolvedValue([]);
      goalService.findActiveByUser.mockResolvedValue([makeGoal({ id: 10 })]);

      const ctx = makeCtx({ availableGoals: [goal] });
      ctx.message = { text: '1', message_id: 200 };

      await scene.handleTextAnswer(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('уже отвечены'),
      );
    });

    it('должен отклонить некорректный номер', async () => {
      const goal = makeGoal({ id: 10 });
      const ctx = makeCtx({ availableGoals: [goal] });
      ctx.message = { text: '5', message_id: 200 };

      await scene.handleTextAnswer(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Напиши номер от 1 до'),
      );
    });

    it('должен показать ошибку при нечисловом вводе', async () => {
      const goal = makeGoal({ id: 10 });
      const ctx = makeCtx({ availableGoals: [goal] });
      ctx.message = { text: 'abc', message_id: 200 };

      await scene.handleTextAnswer(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Напиши номер от 1 до'),
      );
      expect(goalService.findById).not.toHaveBeenCalled();
      expect(reportService.addAnswer).not.toHaveBeenCalled();
    });
  });

  describe('handleButtonAnswer', () => {
    it('должен сохранить ответ с userId и targetDate', async () => {
      const q1 = makeQuestion({ id: 10 });
      const q2 = makeQuestion({ id: 11, question: 'Вопрос 2' });
      const ctx = makeCtx({
        userId: 1,
        targetDate: '2026-02-22',
        goalId: 10,
        questions: [q1, q2],
        currentQuestionIndex: 0,
        lastQuestionMessageId: 50,
      });
      ctx.match = ['answer_5', '5'];

      await scene.handleButtonAnswer(ctx);

      expect(reportService.addAnswer).toHaveBeenCalledWith(
        1,
        10,
        '2026-02-22',
        '5',
      );
    });

    it('должен перейти к следующему вопросу', async () => {
      const q1 = makeQuestion({ id: 10 });
      const q2 = makeQuestion({ id: 11, question: 'Вопрос 2' });
      const ctx = makeCtx({
        userId: 1,
        targetDate: '2026-02-22',
        goalId: 10,
        questions: [q1, q2],
        currentQuestionIndex: 0,
        lastQuestionMessageId: 50,
      });
      ctx.match = ['answer_5', '5'];

      await scene.handleButtonAnswer(ctx);

      expect(ctx.session.currentQuestionIndex).toBe(1);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Вопрос 2'),
        expect.objectContaining({ reply_markup: expect.any(Object) }),
      );
    });

    it('должен завершить отчёт после последнего вопроса', async () => {
      const q1 = makeQuestion({ id: 10 });
      goalService.findActiveByUser.mockResolvedValue([makeGoal({ id: 10 })]);
      const ctx = makeCtx({
        userId: 1,
        targetDate: '2026-02-22',
        goalId: 10,
        questions: [q1],
        currentQuestionIndex: 0,
        lastQuestionMessageId: 50,
      });
      ctx.match = ['answer_да', 'да'];

      await scene.handleButtonAnswer(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('✅ Отчет сохранен!');
    });
  });

  describe('unfilled date flow', () => {
    it('должен предложить заполнить пропущенную дату', async () => {
      const goal = makeGoal({ id: 10 });
      reportService.findLastUnfilledDate.mockResolvedValue('2026-02-21');

      const ctx = makeCtx({ availableGoals: [goal] });
      ctx.message = { text: '1', message_id: 200 };

      await scene.handleTextAnswer(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  callback_data: 'fill_unfilled_2026-02-21',
                }),
              ]),
            ]),
          }),
        }),
      );
    });

    it('должен пропустить пропущенную дату и начать сегодняшний отчёт', async () => {
      const goal = makeGoal({ id: 10 });
      reportService.findLastUnfilledDate.mockResolvedValue('2026-02-21');

      const q1 = makeQuestion({ id: 10, question: 'Вопрос' });
      goalService.findById.mockResolvedValue(makeGoal({ questions: [q1] }));
      reportService.getUnansweredQuestions.mockResolvedValue([q1]);

      const ctx = makeCtx({ availableGoals: [goal] });
      ctx.message = { text: '1', message_id: 200 };
      await scene.handleTextAnswer(ctx);

      await scene.skipUnfilled(ctx);

      expect(ctx.editMessageText).toHaveBeenCalledWith('⏭ Пропущено');
      expect(ctx.session.targetDate).toBeDefined();
    });
  });

  describe('cancelReport', () => {
    it('должен отменить и выйти', async () => {
      const ctx = makeCtx({ userId: 1, targetDate: '2026-02-22' });

      await scene.cancelReport(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('❌ Отчет отменен');
      expect(ctx.scene.leave).toHaveBeenCalled();
    });
  });

  describe('photo handlers', () => {
    const fakeArrayBuffer = new Uint8Array([1, 2, 3]).buffer;
    const fetchOkMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(fakeArrayBuffer),
    });

    beforeEach(() => {
      global.fetch = fetchOkMock;
      fetchOkMock.mockClear();
    });

    afterEach(() => {
      delete (global as any).fetch;
    });

    function makePhotoSession() {
      return {
        userId: 1,
        targetDate: '2026-05-22',
        currentQuestionIndex: 0,
        questions: [makeQuestion({ id: 42, type: 'photo' })],
      };
    }

    it('happy photo path — вызывает addPhotoAnswer с image/jpeg', async () => {
      const ctx = makeCtx(makePhotoSession());
      ctx.message = {
        photo: [{ file_id: 'small' }, { file_id: 'large' }],
      };

      await scene.handlePhoto(ctx);

      expect(ctx.telegram.getFileLink).toHaveBeenCalledWith('large');
      expect(global.fetch).toHaveBeenCalledWith('https://tg/file');
      expect(reportService.addPhotoAnswer).toHaveBeenCalledWith(
        1,
        42,
        '2026-05-22',
        { buffer: expect.any(Buffer), mime: 'image/jpeg' },
      );
    });

    it('document image — вызывает addPhotoAnswer с правильным mime', async () => {
      const ctx = makeCtx(makePhotoSession());
      ctx.message = {
        document: { file_id: 'doc1', mime_type: 'image/png' },
      };

      await scene.handleDocumentImage(ctx);

      expect(ctx.telegram.getFileLink).toHaveBeenCalledWith('doc1');
      expect(reportService.addPhotoAnswer).toHaveBeenCalledWith(
        1,
        42,
        '2026-05-22',
        { buffer: expect.any(Buffer), mime: 'image/png' },
      );
    });

    it('document non-image — отвечает "Только фото", addPhotoAnswer не вызывается', async () => {
      const ctx = makeCtx(makePhotoSession());
      ctx.message = {
        document: { file_id: 'doc2', mime_type: 'application/pdf' },
      };

      await scene.handleDocumentImage(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Только фото'),
      );
      expect(reportService.addPhotoAnswer).not.toHaveBeenCalled();
    });

    it('текст на photo-вопросе → reply "Нужно фото", addAnswer не вызывается', async () => {
      const ctx = makeCtx(makePhotoSession());
      ctx.message = { text: 'какой-то текст' };

      await scene.handleTextAnswer(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Нужно фото'),
      );
      expect(reportService.addAnswer).not.toHaveBeenCalled();
    });

    it('media_group dedup — второй вызов с тем же media_group_id игнорируется', async () => {
      const ctx = makeCtx(makePhotoSession());
      ctx.message = {
        photo: [{ file_id: 'large' }],
        media_group_id: 'grp_1',
      };

      await scene.handlePhoto(ctx);
      // second photo in album — same media_group_id
      ctx.message = {
        photo: [{ file_id: 'large2' }],
        media_group_id: 'grp_1',
      };
      await scene.handlePhoto(ctx);

      expect(reportService.addPhotoAnswer).toHaveBeenCalledTimes(1);
    });

    it('photo handler игнорирует если текущий вопрос не photo', async () => {
      const ctx = makeCtx({
        userId: 1,
        targetDate: '2026-05-22',
        currentQuestionIndex: 0,
        questions: [makeQuestion({ id: 42, type: 'text' })],
      });
      ctx.message = {
        photo: [{ file_id: 'large' }],
      };

      await scene.handlePhoto(ctx);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(reportService.addPhotoAnswer).not.toHaveBeenCalled();
    });
  });
});
