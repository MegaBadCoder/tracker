import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getBotToken } from 'nestjs-telegraf';
import { TimerSessionService } from './timer-session.service';
import { UserService } from '../user/application/user.service';
import { TimerSession, Task } from '../../shared/entities';

function makeSession(overrides: Partial<TimerSession> = {}): TimerSession {
  const session = new TimerSession();
  Object.assign(session, {
    id: 'session-1',
    userId: 1,
    taskId: 'task-1',
    phase: 1,
    lastStartTime: null,
    countTimeAfterPause: null,
    expiresAt: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    task: { id: 'task-1', title: 'Тестовая задача' } as Task,
    ...overrides,
  });
  return session;
}

describe('TimerSessionService', () => {
  let service: TimerSessionService;
  let timerRepo: Record<string, jest.Mock>;
  let userService: Record<string, jest.Mock>;
  let bot: { telegram: { sendMessage: jest.Mock } };

  beforeEach(async () => {
    timerRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((data) => makeSession(data)),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    userService = {
      getTelegramId: jest.fn().mockResolvedValue(999),
    };

    bot = {
      telegram: {
        sendMessage: jest.fn().mockResolvedValue(true),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimerSessionService,
        { provide: getRepositoryToken(TimerSession), useValue: timerRepo },
        { provide: UserService, useValue: userService },
        { provide: getBotToken(), useValue: bot },
      ],
    }).compile();

    service = module.get(TimerSessionService);
  });

  describe('upsert', () => {
    it('создаёт новую сессию, если нет существующей', async () => {
      timerRepo.findOne.mockResolvedValue(null);

      const result = await service.upsert(1, {
        taskId: 'task-1',
        phase: 1,
        lastStartTime: Date.now(),
        isActive: true,
        expiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
      });

      expect(timerRepo.create).toHaveBeenCalled();
      expect(timerRepo.save).toHaveBeenCalled();
      expect(result.taskId).toBe('task-1');
      expect(result.isActive).toBe(true);
    });

    it('обновляет существующую сессию', async () => {
      const existing = makeSession({ phase: 1, isActive: true });
      timerRepo.findOne.mockResolvedValue(existing);

      await service.upsert(1, {
        taskId: 'task-1',
        phase: 3,
        lastStartTime: null,
        countTimeAfterPause: 120,
        isActive: false,
      });

      expect(timerRepo.create).not.toHaveBeenCalled();
      expect(existing.phase).toBe(3);
      expect(existing.isActive).toBe(false);
      expect(existing.countTimeAfterPause).toBe(120);
      expect(timerRepo.save).toHaveBeenCalledWith(existing);
    });

    it('корректно парсит expiresAt в Date', async () => {
      timerRepo.findOne.mockResolvedValue(null);
      const expires = '2026-03-10T12:00:00.000Z';

      const result = await service.upsert(1, {
        taskId: 'task-1',
        phase: 1,
        isActive: true,
        expiresAt: expires,
      });

      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt!.toISOString()).toBe(expires);
    });
  });

  describe('getLatest', () => {
    it('возвращает последнюю сессию с relations', async () => {
      const session = makeSession();
      timerRepo.findOne.mockResolvedValue(session);

      const result = await service.getLatest(1);

      expect(result).toBe(session);
      expect(timerRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: { updatedAt: 'DESC' },
        relations: ['task', 'task.pomodoroConfig'],
      });
    });

    it('возвращает null если нет сессий', async () => {
      timerRepo.findOne.mockResolvedValue(null);
      const result = await service.getLatest(1);
      expect(result).toBeNull();
    });
  });

  describe('deactivate', () => {
    it('удаляет сессию и отправляет уведомление по telegramId', async () => {
      const session = makeSession({
        task: { id: 'task-1', title: 'Код ревью' } as Task,
      });
      timerRepo.findOne.mockResolvedValue(session);

      await service.deactivate(1);

      expect(userService.getTelegramId).toHaveBeenCalledWith(1);
      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        999,
        '⏹ Таймер по задаче "Код ревью" остановлен',
      );
      expect(timerRepo.remove).toHaveBeenCalledWith(session);
    });

    it('ничего не делает если сессии нет', async () => {
      timerRepo.findOne.mockResolvedValue(null);

      await service.deactivate(1);

      expect(timerRepo.remove).not.toHaveBeenCalled();
      expect(bot.telegram.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleExpiredTimers — крон', () => {
    it('деактивирует истёкшие сессии и отправляет Telegram-сообщение по telegramId', async () => {
      const expired = makeSession({
        id: 'expired-1',
        userId: 1,
        isActive: true,
        expiresAt: new Date(Date.now() - 1000),
        task: { id: 'task-1', title: 'Написать отчёт' } as Task,
      });

      timerRepo.find.mockResolvedValue([expired]);

      await service.handleExpiredTimers();

      expect(expired.isActive).toBe(false);
      expect(timerRepo.save).toHaveBeenCalledWith(expired);
      expect(userService.getTelegramId).toHaveBeenCalledWith(1);
      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        999,
        '⏰ Таймер по задаче "Написать отчёт" завершён!',
      );
    });

    it('обрабатывает несколько истёкших сессий', async () => {
      const sessions = [
        makeSession({
          id: 'e1',
          userId: 1,
          task: { id: 't1', title: 'Задача 1' } as Task,
        }),
        makeSession({
          id: 'e2',
          userId: 1,
          task: { id: 't2', title: 'Задача 2' } as Task,
        }),
      ];

      timerRepo.find.mockResolvedValue(sessions);

      await service.handleExpiredTimers();

      expect(timerRepo.save).toHaveBeenCalledTimes(2);
      expect(bot.telegram.sendMessage).toHaveBeenCalledTimes(2);
      expect(sessions[0].isActive).toBe(false);
      expect(sessions[1].isActive).toBe(false);
    });

    it('не падает если нет истёкших сессий', async () => {
      timerRepo.find.mockResolvedValue([]);

      await service.handleExpiredTimers();

      expect(timerRepo.save).not.toHaveBeenCalled();
      expect(bot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('продолжает обработку если Telegram API упал', async () => {
      const s1 = makeSession({
        id: 'e1',
        userId: 1,
        task: { id: 't1', title: 'Задача 1' } as Task,
      });
      const s2 = makeSession({
        id: 'e2',
        userId: 1,
        task: { id: 't2', title: 'Задача 2' } as Task,
      });

      timerRepo.find.mockResolvedValue([s1, s2]);
      bot.telegram.sendMessage
        .mockRejectedValueOnce(new Error('Telegram API error'))
        .mockResolvedValueOnce(true);

      await service.handleExpiredTimers();

      expect(s1.isActive).toBe(false);
      expect(s2.isActive).toBe(false);
      expect(timerRepo.save).toHaveBeenCalledTimes(2);
      expect(bot.telegram.sendMessage).toHaveBeenCalledTimes(2);
    });
  });
});
