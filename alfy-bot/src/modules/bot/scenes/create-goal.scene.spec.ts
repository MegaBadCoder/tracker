import { Test, TestingModule } from '@nestjs/testing';
import { addDays, addWeeks, startOfDay } from 'date-fns';
import { DateParserService } from '../../../shared/services/date-parser.service';
import { GoalService } from '../../goal/application/goal.service';
import { UserService } from '../../user/application/user.service';
import { CreateGoalScene } from './create-goal.scene';

describe('CreateGoalScene - Simple Goal', () => {
  let scene: CreateGoalScene;
  let dateParser: jest.Mocked<DateParserService>;
  let goalService: jest.Mocked<GoalService>;
  let userService: jest.Mocked<UserService>;
  let mockCtx: any;

  beforeEach(async () => {
    const dateParserMock = {
      parse: jest.fn(),
      validateStartDate: jest.fn(),
      validateEndDate: jest.fn(),
    };

    const goalServiceMock = {
      create: jest.fn(),
    };

    const userServiceMock = {
      findOrCreate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateGoalScene,
        { provide: DateParserService, useValue: dateParserMock },
        { provide: GoalService, useValue: goalServiceMock },
        { provide: UserService, useValue: userServiceMock },
      ],
    }).compile();

    scene = module.get<CreateGoalScene>(CreateGoalScene);
    dateParser = module.get(DateParserService);
    goalService = module.get(GoalService);
    userService = module.get(UserService);

    mockCtx = {
      reply: jest.fn().mockResolvedValue({ message_id: 123 }),
      editMessageText: jest.fn().mockResolvedValue(true),
      answerCbQuery: jest.fn().mockResolvedValue(true),
      deleteMessage: jest.fn().mockResolvedValue(true),
      scene: {
        leave: jest.fn().mockResolvedValue(true),
      },
      session: {},
      from: { id: 456 },
      message: null,
      match: null,
      chat: { id: 789 },
      telegram: {
        editMessageText: jest.fn().mockResolvedValue(true),
      },
    };
  });

  describe('onEnter', () => {
    it('должен показать выбор типа цели', async () => {
      await scene.onEnter(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        'Какую цель хочешь поставить?',
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ callback_data: 'type_simple' }),
              ]),
            ]),
          }),
        }),
      );
      expect(mockCtx.session.messageId).toBe(123);
    });
  });

  describe('handleGoalType', () => {
    it('должен установить тип simple и попросить ввести название', async () => {
      mockCtx.match = ['type_simple', 'simple'];
      mockCtx.session.messageId = 123;

      await scene.handleGoalType(mockCtx);

      expect(mockCtx.session.goalType).toBe('simple');
      expect(mockCtx.answerCbQuery).toHaveBeenCalled();
      expect(mockCtx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('Простая цель'),
        expect.any(Object),
      );
    });

    it('должен показать сообщение о недоступности для SMART', async () => {
      mockCtx.match = ['type_smart', 'smart'];

      await scene.handleGoalType(mockCtx);

      expect(mockCtx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('в разработке'),
        expect.any(Object),
      );
    });
  });

  describe('handleText - название цели', () => {
    it('должен сохранить название и показать выбор даты начала', async () => {
      mockCtx.message = { text: 'Моя цель', message_id: 100 };
      mockCtx.session = { messageId: 123, goalType: 'simple' };

      await scene.handleText(mockCtx);

      expect(mockCtx.session.goalName).toBe('Моя цель');
      expect(mockCtx.deleteMessage).toHaveBeenCalledWith(100);
      expect(mockCtx.telegram.editMessageText).toHaveBeenCalledWith(
        mockCtx.chat.id,
        123,
        undefined,
        expect.stringContaining('Моя цель'),
        expect.any(Object),
      );
    });
  });

  describe('handleStartToday', () => {
    it('должен установить дату начала на сегодня', async () => {
      mockCtx.session = { goalName: 'Моя цель', messageId: 123 };
      const today = startOfDay(new Date());

      await scene.handleStartToday(mockCtx);

      expect(mockCtx.session.startDate).toEqual(today);
      expect(mockCtx.telegram.editMessageText).toHaveBeenCalled();
    });
  });

  describe('handleStartTomorrow', () => {
    it('должен установить дату начала на завтра', async () => {
      mockCtx.session = { goalName: 'Моя цель', messageId: 123 };
      const tomorrow = addDays(startOfDay(new Date()), 1);

      await scene.handleStartTomorrow(mockCtx);

      expect(mockCtx.session.startDate).toEqual(tomorrow);
    });
  });

  describe('handleStartWeek', () => {
    it('должен установить дату начала через неделю', async () => {
      mockCtx.session = { goalName: 'Моя цель', messageId: 123 };
      const nextWeek = addWeeks(startOfDay(new Date()), 1);

      await scene.handleStartWeek(mockCtx);

      expect(mockCtx.session.startDate).toEqual(nextWeek);
    });
  });

  describe('handleEndDate', () => {
    it('должен установить дату окончания и спросить про точку A', async () => {
      const startDate = startOfDay(new Date());
      mockCtx.session = {
        goalName: 'Моя цель',
        startDate,
        messageId: 123,
      };
      mockCtx.match = ['end_12weeks', '12weeks'];

      await scene.handleEndDate(mockCtx);

      expect(mockCtx.session.endDate).toBeDefined();
      expect(mockCtx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('Зафиксировать точку A'),
        expect.any(Object),
      );
    });
  });

  describe('handlePointANo', () => {
    it('должен сохранить цель без точки A и предложить настройку вопросов', async () => {
      const startDate = startOfDay(new Date());
      const endDate = addWeeks(startDate, 1);

      mockCtx.session = {
        goalName: 'Моя цель',
        goalType: 'simple',
        startDate,
        endDate,
        messageId: 123,
      };

      userService.findOrCreate.mockResolvedValue({
        id: 1,
        user_id: 456,
      } as any);

      goalService.create.mockResolvedValue({
        id: 10,
        goal_name: 'Моя цель',
      } as any);

      await scene.handlePointANo(mockCtx);

      expect(mockCtx.session.pointA).toBe(false);
      expect(userService.findOrCreate).toHaveBeenCalledWith(456, {});
      expect(goalService.create).toHaveBeenCalledWith(1, {
        goal_name: 'Моя цель',
        goal_start: expect.any(String),
        goal_end: expect.any(String),
      });
      expect(mockCtx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('поставлена'),
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('настроить вопросы'),
        expect.any(Object),
      );
    });
  });

  describe('handlePointAYes', () => {
    it('должен установить pointA=true и сохранить цель', async () => {
      const startDate = startOfDay(new Date());
      const endDate = addWeeks(startDate, 1);

      mockCtx.session = {
        goalName: 'Моя цель',
        goalType: 'simple',
        startDate,
        endDate,
        messageId: 123,
      };

      userService.findOrCreate.mockResolvedValue({
        id: 1,
        user_id: 456,
      } as any);

      goalService.create.mockResolvedValue({
        id: 10,
        goal_name: 'Моя цель',
      } as any);

      await scene.handlePointAYes(mockCtx);

      expect(mockCtx.session.pointA).toBe(true);
      expect(goalService.create).toHaveBeenCalled();
    });
  });

  describe('cancelGoal', () => {
    it('должен отменить создание цели', async () => {
      mockCtx.session = { goalName: 'Моя цель' };

      await scene.cancelGoal(mockCtx);

      expect(mockCtx.answerCbQuery).toHaveBeenCalled();
      expect(mockCtx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('отменено'),
      );
      expect(mockCtx.scene.leave).toHaveBeenCalled();
    });
  });

  describe('handleStartCustom', () => {
    it('должен перейти в режим ожидания кастомной даты', async () => {
      mockCtx.session = { goalName: 'Моя цель', messageId: 123 };

      await scene.handleStartCustom(mockCtx);

      expect(mockCtx.session.awaitingCustomStart).toBe(true);
      expect(mockCtx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('дд.мм.гггг'),
        expect.any(Object),
      );
    });
  });

  describe('handleText - кастомная дата начала', () => {
    it('должен принять валидную кастомную дату начала', async () => {
      const customDate = addDays(new Date(), 5);
      mockCtx.message = { text: '27.01.2026', message_id: 100 };
      mockCtx.session = {
        goalName: 'Моя цель',
        messageId: 123,
        awaitingCustomStart: true,
      };

      dateParser.parse.mockReturnValue({
        success: true,
        date: customDate,
      });
      dateParser.validateStartDate.mockReturnValue({ valid: true });

      await scene.handleText(mockCtx);

      expect(mockCtx.session.startDate).toEqual(customDate);
      expect(mockCtx.session.awaitingCustomStart).toBe(false);
    });

    it('должен показать ошибку при невалидной дате', async () => {
      mockCtx.message = { text: 'неправильная дата', message_id: 100 };
      mockCtx.session = {
        goalName: 'Моя цель',
        messageId: 123,
        awaitingCustomStart: true,
      };

      dateParser.parse.mockReturnValue({
        success: false,
        error: 'Неверный формат даты',
      });

      await scene.handleText(mockCtx);

      expect(mockCtx.session.startDate).toBeUndefined();
      expect(mockCtx.telegram.editMessageText).toHaveBeenCalledWith(
        mockCtx.chat.id,
        123,
        undefined,
        expect.stringContaining('Неверный формат'),
        expect.any(Object),
      );
    });
  });

  describe('Полный флоу создания простой цели', () => {
    it('должен пройти весь процесс создания цели', async () => {
      await scene.onEnter(mockCtx);
      expect(mockCtx.reply).toHaveBeenCalled();

      mockCtx.match = ['type_simple', 'simple'];
      await scene.handleGoalType(mockCtx);
      expect(mockCtx.session.goalType).toBe('simple');

      mockCtx.message = { text: 'Пробежать марафон', message_id: 100 };
      await scene.handleText(mockCtx);
      expect(mockCtx.session.goalName).toBe('Пробежать марафон');

      await scene.handleStartToday(mockCtx);
      expect(mockCtx.session.startDate).toBeDefined();

      mockCtx.match = ['end_12weeks', '12weeks'];
      await scene.handleEndDate(mockCtx);
      expect(mockCtx.session.endDate).toBeDefined();

      userService.findOrCreate.mockResolvedValue({
        id: 1,
        user_id: 456,
      } as any);
      goalService.create.mockResolvedValue({ id: 10 } as any);

      await scene.handlePointANo(mockCtx);

      expect(mockCtx.session.pointA).toBe(false);
      expect(goalService.create).toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('настроить вопросы'),
        expect.any(Object),
      );
    });
  });
});
