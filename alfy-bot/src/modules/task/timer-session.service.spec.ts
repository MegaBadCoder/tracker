import { Test, TestingModule } from '@nestjs/testing';
import { TimerSessionService } from './timer-session.service';
import { TimerSessionRepositoryPort } from './domain/timer-session-repository.port';
import { NotificationPort } from './domain/notification.port';
import { UserEventsPort } from '../events/domain/user-events.port';
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
  let notification: Record<string, jest.Mock>;
  let events: Record<string, jest.Mock>;

  beforeEach(async () => {
    timerRepo = {
      findLatestByUser: jest.fn().mockResolvedValue(null),
      findExpiredActive: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((data) => makeSession(data)),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    notification = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    events = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimerSessionService,
        { provide: TimerSessionRepositoryPort, useValue: timerRepo },
        { provide: NotificationPort, useValue: notification },
        { provide: UserEventsPort, useValue: events },
      ],
    }).compile();

    service = module.get(TimerSessionService);
  });

  describe('upsert', () => {
    it('создаёт новую сессию, если нет существующей', async () => {
      timerRepo.findLatestByUser.mockResolvedValue(null);

      const result = await service.upsert(1, {
        taskId: 'task-1',
        phase: 1,
        lastStartTime: Date.now(),
        isActive: true,
        expiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
      });

      expect(timerRepo.create).toHaveBeenCalled();
      expect(timerRepo.save).toHaveBeenCalled();
      expect(events.emit).toHaveBeenCalledWith(1, 'timer.updated');
      expect(result.taskId).toBe('task-1');
      expect(result.isActive).toBe(true);
    });

    it('обновляет существующую сессию', async () => {
      const existing = makeSession({ phase: 1, isActive: true });
      timerRepo.findLatestByUser.mockResolvedValue(existing);

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
      timerRepo.findLatestByUser.mockResolvedValue(null);
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
      timerRepo.findLatestByUser.mockResolvedValue(session);

      const result = await service.getLatest(1);

      expect(result).toBe(session);
      expect(timerRepo.findLatestByUser).toHaveBeenCalledWith(1, [
        'task',
        'task.pomodoroConfig',
      ]);
    });

    it('возвращает null если нет сессий', async () => {
      timerRepo.findLatestByUser.mockResolvedValue(null);
      const result = await service.getLatest(1);
      expect(result).toBeNull();
    });
  });

  describe('deactivate', () => {
    it('удаляет сессию и отправляет уведомление', async () => {
      const session = makeSession({
        task: { id: 'task-1', title: 'Код ревью' } as Task,
      });
      timerRepo.findLatestByUser.mockResolvedValue(session);

      await service.deactivate(1);

      expect(notification.send).toHaveBeenCalledWith(
        1,
        '⏹ Таймер по задаче "Код ревью" остановлен',
      );
      expect(timerRepo.remove).toHaveBeenCalledWith(session);
      expect(events.emit).toHaveBeenCalledWith(1, 'timer.updated');
    });

    it('ничего не делает если сессии нет', async () => {
      timerRepo.findLatestByUser.mockResolvedValue(null);

      await service.deactivate(1);

      expect(timerRepo.remove).not.toHaveBeenCalled();
      expect(notification.send).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });
  });

  describe('processExpiredTimers', () => {
    it('деактивирует истёкшие сессии и отправляет уведомление', async () => {
      const expired = makeSession({
        id: 'expired-1',
        userId: 1,
        isActive: true,
        expiresAt: new Date(Date.now() - 1000),
        task: { id: 'task-1', title: 'Написать отчёт' } as Task,
      });

      timerRepo.findExpiredActive.mockResolvedValue([expired]);

      await service.processExpiredTimers();

      expect(expired.isActive).toBe(false);
      expect(timerRepo.save).toHaveBeenCalledWith(expired);
      expect(notification.send).toHaveBeenCalledWith(
        1,
        '⏰ Таймер по задаче "Написать отчёт" завершён!',
      );
      expect(events.emit).toHaveBeenCalledWith(1, 'timer.updated');
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

      timerRepo.findExpiredActive.mockResolvedValue(sessions);

      await service.processExpiredTimers();

      expect(timerRepo.save).toHaveBeenCalledTimes(2);
      expect(notification.send).toHaveBeenCalledTimes(2);
      expect(sessions[0].isActive).toBe(false);
      expect(sessions[1].isActive).toBe(false);
    });

    it('не падает если нет истёкших сессий', async () => {
      timerRepo.findExpiredActive.mockResolvedValue([]);

      await service.processExpiredTimers();

      expect(timerRepo.save).not.toHaveBeenCalled();
      expect(notification.send).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('вызывает notification.send для каждой истёкшей сессии', async () => {
      const s1 = makeSession({
        id: 'e1',
        userId: 1,
        task: { id: 't1', title: 'Задача 1' } as Task,
      });
      const s2 = makeSession({
        id: 'e2',
        userId: 2,
        task: { id: 't2', title: 'Задача 2' } as Task,
      });

      timerRepo.findExpiredActive.mockResolvedValue([s1, s2]);

      await service.processExpiredTimers();

      expect(notification.send).toHaveBeenCalledWith(
        1,
        '⏰ Таймер по задаче "Задача 1" завершён!',
      );
      expect(notification.send).toHaveBeenCalledWith(
        2,
        '⏰ Таймер по задаче "Задача 2" завершён!',
      );
    });
  });
});
