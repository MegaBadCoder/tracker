import { Test, TestingModule } from '@nestjs/testing';
import { OverdueRecurringService } from './overdue-recurring.service';
import { TaskRepositoryPort } from './domain/task-repository.port';
import { UserSettingsPort } from './domain/user-settings.port';
import { Task } from '../../shared/entities';
import type { RecurrenceRule } from '../../shared/types/recurrence.types';

function makeTask(overrides: Partial<Task> = {}): Task {
  const task = new Task();
  Object.assign(task, {
    id: 't1',
    userId: 1,
    title: 'Тестовая повторяющаяся задача',
    description: null,
    completed: false,
    priority: null,
    dueDate: null,
    deadline: null,
    location: null,
    tags: null,
    projectId: null,
    columnId: null,
    order: 0,
    checklist: null,
    pomodoroConfig: null,
    recurrence: null,
    recurringCompletedCount: 0,
    recurringParentId: null,
    isAutoCreated: false,
    isOverdue: false,
    onMissed: 'shift',
    recurringParent: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return task;
}

const dailyRule: RecurrenceRule = { frequency: 'daily', interval: 1 };

describe('OverdueRecurringService', () => {
  let service: OverdueRecurringService;
  let repo: Record<string, jest.Mock>;
  let userSettings: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      findAllByUser: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) => Promise.resolve(makeTask(data))),
      save: jest.fn().mockImplementation((task) => Promise.resolve(task)),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(true),
      incrementPomodoroCompleted: jest.fn().mockResolvedValue(undefined),
      updateChecklist: jest.fn().mockResolvedValue(undefined),
      updatePomodoroConfig: jest.fn().mockResolvedValue(undefined),
      findAllByProject: jest.fn().mockResolvedValue([]),
      updatePosition: jest.fn().mockResolvedValue(null),
      reorderTasks: jest.fn().mockResolvedValue(undefined),
      findByParentId: jest.fn().mockResolvedValue([]),
      deleteByParentId: jest.fn().mockResolvedValue(undefined),
      clearParentId: jest.fn().mockResolvedValue(undefined),
      findOverdueRecurringCandidates: jest.fn().mockResolvedValue([]),
      markOverdue: jest.fn().mockResolvedValue(undefined),
    };

    userSettings = {
      getTimezone: jest.fn().mockResolvedValue('UTC'),
      listAllUserIds: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OverdueRecurringService,
        { provide: TaskRepositoryPort, useValue: repo },
        { provide: UserSettingsPort, useValue: userSettings },
      ],
    }).compile();

    service = module.get(OverdueRecurringService);
  });

  describe('processForUser — freeze branch', () => {
    it('создаёт следующий instance и помечает старый overdue', async () => {
      const candidate = makeTask({
        id: 't1',
        userId: 1,
        dueDate: new Date('2026-04-28T09:00:00.000Z'),
        completed: false,
        isOverdue: false,
        recurrence: dailyRule,
        onMissed: 'freeze',
        recurringParentId: null,
        recurringCompletedCount: 0,
      });
      repo.findOverdueRecurringCandidates.mockResolvedValue([candidate]);

      await service.processForUser(1, 'UTC', new Date('2026-04-29T00:00:00.000Z'));

      expect(repo.markOverdue).toHaveBeenCalledTimes(1);
      expect(repo.markOverdue).toHaveBeenCalledWith('t1');

      expect(repo.create).toHaveBeenCalledTimes(1);
      const arg = repo.create.mock.calls[0][0];
      expect(arg.dueDate.getTime()).toBe(new Date('2026-04-29T09:00:00.000Z').getTime());
      expect(arg.recurrence).toEqual(expect.objectContaining({ frequency: 'daily' }));
      expect(arg.onMissed).toBe('freeze');
      expect(arg.isAutoCreated).toBe(true);
      expect(arg.recurringParentId).toBe('t1');
    });
  });

  describe('processForUser — shift branch', () => {
    it('сдвигает dueDate, не вызывает markOverdue / create', async () => {
      const candidate = makeTask({
        id: 't1',
        userId: 1,
        dueDate: new Date('2026-04-28T09:00:00.000Z'),
        completed: false,
        isOverdue: false,
        recurrence: dailyRule,
        onMissed: 'shift',
        recurringParentId: null,
        recurringCompletedCount: 0,
      });
      repo.findOverdueRecurringCandidates.mockResolvedValue([candidate]);

      await service.processForUser(1, 'UTC', new Date('2026-04-29T00:00:00.000Z'));

      expect(repo.markOverdue).not.toHaveBeenCalled();
      expect(repo.create).not.toHaveBeenCalled();

      expect(repo.save).toHaveBeenCalledTimes(1);
      const saved = repo.save.mock.calls[0][0];
      expect(saved.dueDate.getTime()).toBe(new Date('2026-04-29T09:00:00.000Z').getTime());
    });

    it('серия закончилась → recurrence=null, dueDate без изменений', async () => {
      const originalDue = new Date('2026-04-28T09:00:00.000Z');
      const candidate = makeTask({
        id: 't1',
        userId: 1,
        dueDate: originalDue,
        completed: false,
        isOverdue: false,
        recurrence: { frequency: 'daily', interval: 1, endCount: 5 },
        onMissed: 'shift',
        recurringParentId: null,
        recurringCompletedCount: 5,
      });
      repo.findOverdueRecurringCandidates.mockResolvedValue([candidate]);

      await service.processForUser(1, 'UTC', new Date('2026-04-29T00:00:00.000Z'));

      expect(repo.markOverdue).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledTimes(1);
      const saved = repo.save.mock.calls[0][0];
      expect(saved.recurrence).toBeNull();
      expect(saved.dueDate.getTime()).toBe(originalDue.getTime());
    });
  });

  describe('processForUser — идемпотентность', () => {
    it('пустой список кандидатов → никаких downstream вызовов', async () => {
      repo.findOverdueRecurringCandidates.mockResolvedValue([]);

      await service.processForUser(1, 'UTC', new Date('2026-04-29T00:00:00.000Z'));

      expect(repo.markOverdue).not.toHaveBeenCalled();
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('processAllUsersAtMidnight — TZ gating', () => {
    it('UTC=19:00 — обрабатывает только пользователя в Asia/Yekaterinburg (полночь там)', async () => {
      userSettings.listAllUserIds.mockResolvedValue([1, 2]);
      userSettings.getTimezone.mockImplementation((uid: number) => {
        if (uid === 1) return Promise.resolve('UTC');
        if (uid === 2) return Promise.resolve('Asia/Yekaterinburg');
        return Promise.resolve('UTC');
      });

      await service.processAllUsersAtMidnight(new Date('2026-04-29T19:00:00.000Z'));

      expect(repo.findOverdueRecurringCandidates).toHaveBeenCalledTimes(1);
      const calledUserIds = repo.findOverdueRecurringCandidates.mock.calls.map(
        (c) => c[0],
      );
      expect(calledUserIds).toEqual([2]);
    });

    it('UTC=18:00 — никто не на полночи → ничего не обрабатывает', async () => {
      userSettings.listAllUserIds.mockResolvedValue([1, 2]);
      userSettings.getTimezone.mockImplementation((uid: number) => {
        if (uid === 1) return Promise.resolve('UTC');
        if (uid === 2) return Promise.resolve('Asia/Yekaterinburg');
        return Promise.resolve('UTC');
      });

      await service.processAllUsersAtMidnight(new Date('2026-04-29T18:00:00.000Z'));

      expect(repo.findOverdueRecurringCandidates).not.toHaveBeenCalled();
    });
  });
});
