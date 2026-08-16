import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskRepositoryPort } from './domain/task-repository.port';
import { UserSettingsPort } from './domain/user-settings.port';
import { Task, PomodoroConfig } from '../../shared/entities';
import type { RecurrenceRule } from '../../shared/types/recurrence.types';

function makeTask(overrides: Partial<Task> = {}): Task {
  const task = new Task();
  Object.assign(task, {
    id: 'task-1',
    userId: 1,
    title: 'Тестовая задача',
    description: null,
    completed: false,
    priority: null,
    dueDate: null,
    recurrenceAnchorDate: null,
    deadline: null,
    location: null,
    tags: null,
    checklist: null,
    pomodoroConfig: null,
    recurrence: null,
    recurringCompletedCount: 0,
    recurringParentId: null,
    isAutoCreated: false,
    recurringParent: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return task;
}

function makePomodoroConfig(
  overrides: Partial<PomodoroConfig> = {},
): PomodoroConfig {
  const config = new PomodoroConfig();
  Object.assign(config, {
    id: 'pomo-1',
    taskId: 'task-1',
    pomodoroCount: 4,
    pomodoroDuration: 25,
    shortBreak: 5,
    longBreak: 15,
    longBreakInterval: 4,
    pomodoroCompleted: 0,
    ...overrides,
  });
  return config;
}

describe('TaskService', () => {
  let service: TaskService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      findAllByUser: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation((data) => Promise.resolve(makeTask(data))),
      save: jest.fn().mockImplementation((task) => Promise.resolve(task)),
      update: jest
        .fn()
        .mockImplementation((id, _userId, data) =>
          Promise.resolve(makeTask({ id, ...data })),
        ),
      delete: jest.fn().mockResolvedValue(true),
      incrementPomodoroCompleted: jest.fn().mockResolvedValue(undefined),
      updateChecklist: jest
        .fn()
        .mockImplementation((task, data) =>
          Promise.resolve(makeTask({ ...task, checklist: data })),
        ),
      findByParentId: jest.fn().mockResolvedValue([]),
      deleteByParentId: jest.fn().mockResolvedValue(undefined),
      clearParentId: jest.fn().mockResolvedValue(undefined),
      updatePomodoroConfig: jest.fn().mockImplementation((task, data) => {
        if (data === null) {
          return Promise.resolve(makeTask({ ...task, pomodoroConfig: null }));
        }
        const config = task.pomodoroConfig
          ? makePomodoroConfig({ ...task.pomodoroConfig, ...data })
          : makePomodoroConfig(data);
        return Promise.resolve(makeTask({ ...task, pomodoroConfig: config }));
      }),
    };

    const userSettings = {
      getTimezone: jest.fn().mockResolvedValue('UTC'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: TaskRepositoryPort, useValue: repo },
        { provide: UserSettingsPort, useValue: userSettings },
      ],
    }).compile();

    service = module.get(TaskService);
  });

  describe('create — простая задача', () => {
    it('создаёт задачу без pomodoroConfig', async () => {
      const result = await service.create(1, {
        title: 'Купить молоко',
      });

      expect(repo.create).toHaveBeenCalledTimes(1);

      const arg = repo.create.mock.calls[0][0] as Partial<Task>;
      expect(arg.title).toBe('Купить молоко');
      expect(arg.userId).toBe(1);
      expect(arg.pomodoroConfig).toBeUndefined();
      expect(result.title).toBe('Купить молоко');
    });

    it('передаёт description, priority, tags', async () => {
      await service.create(1, {
        title: 'Задача',
        description: 'Описание',
        priority: 'high',
        tags: ['работа'],
      });

      const arg = repo.create.mock.calls[0][0] as Partial<Task>;
      expect(arg.description).toBe('Описание');
      expect(arg.priority).toBe('high');
      expect(arg.tags).toEqual(['работа']);
    });

    it('парсит dueDate и deadline в Date', async () => {
      await service.create(1, {
        title: 'Задача',
        dueDate: '2026-03-15T00:00:00.000Z',
        deadline: '2026-03-20T00:00:00.000Z',
      });

      const arg = repo.create.mock.calls[0][0] as Partial<Task>;
      expect(arg.dueDate).toBeInstanceOf(Date);
      expect(arg.deadline).toBeInstanceOf(Date);
    });
  });

  describe('create — помодоро задача (дефолтные настройки)', () => {
    it('создаёт задачу с pomodoroConfig при isPomodoroTask=true', async () => {
      await service.create(1, {
        title: 'Помодоро задача',
        isPomodoroTask: true,
      });

      const arg = repo.create.mock.calls[0][0] as Partial<Task>;
      expect(arg.pomodoroConfig).toBeInstanceOf(PomodoroConfig);
      // Без явных значений — поля не задаются (дефолты применяются на уровне БД)
    });
  });

  describe('create — помодоро задача (кастомные настройки)', () => {
    it('применяет пользовательские значения помодоро', async () => {
      await service.create(1, {
        title: 'Кастом помодоро',
        isPomodoroTask: true,
        pomodoroCount: 8,
        pomodoroDuration: 50,
        shortBreak: 10,
        longBreak: 30,
        longBreakInterval: 2,
      });

      const arg = repo.create.mock.calls[0][0] as Partial<Task>;
      expect(arg.pomodoroConfig).toBeInstanceOf(PomodoroConfig);
      expect(arg.pomodoroConfig!.pomodoroCount).toBe(8);
      expect(arg.pomodoroConfig!.pomodoroDuration).toBe(50);
      expect(arg.pomodoroConfig!.shortBreak).toBe(10);
      expect(arg.pomodoroConfig!.longBreak).toBe(30);
      expect(arg.pomodoroConfig!.longBreakInterval).toBe(2);
    });

    it('частично переопределяет настройки', async () => {
      await service.create(1, {
        title: 'Частичные настройки',
        isPomodoroTask: true,
        pomodoroDuration: 45,
      });

      const config = repo.create.mock.calls[0][0]
        .pomodoroConfig as PomodoroConfig;
      expect(config.pomodoroDuration).toBe(45);
      // Остальные поля не заданы — дефолты применит БД
      expect(config.pomodoroCount).toBeUndefined();
    });
  });

  describe('create — isPomodoroTask=false не создаёт конфиг', () => {
    it('игнорирует помодоро-поля если isPomodoroTask не true', async () => {
      await service.create(1, {
        title: 'Обычная',
        isPomodoroTask: false,
        pomodoroCount: 8,
      });

      const arg = repo.create.mock.calls[0][0] as Partial<Task>;
      expect(arg.pomodoroConfig).toBeUndefined();
    });
  });

  describe('update', () => {
    it('обновляет поля задачи', async () => {
      repo.findById.mockResolvedValue(makeTask());

      const result = await service.update(1, 'task-1', {
        title: 'Новое название',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Новое название',
        }),
      );
      expect(result.task.title).toBe('Новое название');
    });

    it('priority: null сбрасывает приоритет', async () => {
      repo.findById.mockResolvedValue(makeTask({ priority: 'high' }));

      const result = await service.update(1, 'task-1', { priority: null });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ priority: null }),
      );
      expect(result.task.priority).toBeNull();
    });

    it('бросает NotFoundException если задача не найдена', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.update(1, 'nope', { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('бросает BadRequestException если задача isOverdue=true (immutable)', async () => {
      repo.findById.mockResolvedValue(makeTask({ isOverdue: true }));

      await expect(
        service.update(1, 'task-1', { title: 'Новое' }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('update — reschedule recurring dueDate', () => {
    const monday = new Date('2026-04-06T10:00:00.000Z');
    const wednesday = new Date('2026-04-08T15:00:00.000Z');
    const weekly: RecurrenceRule = { frequency: 'weekly', interval: 1 };

    it('default scope this: sets anchor to old dueDate', async () => {
      repo.findById.mockResolvedValue(
        makeTask({
          recurrence: weekly,
          dueDate: monday,
          recurrenceAnchorDate: null,
        }),
      );

      const result = await service.update(1, 'task-1', {
        dueDate: wednesday.toISOString(),
      });

      expect(result.task.dueDate).toEqual(wednesday);
      expect(result.task.recurrenceAnchorDate).toEqual(monday);
    });

    it('повторный this не перезаписывает якорь', async () => {
      const friday = new Date('2026-04-10T12:00:00.000Z');
      repo.findById.mockResolvedValue(
        makeTask({
          recurrence: weekly,
          dueDate: wednesday,
          recurrenceAnchorDate: monday,
        }),
      );

      const result = await service.update(1, 'task-1', {
        dueDate: friday.toISOString(),
        rescheduleScope: 'this',
      });

      expect(result.task.dueDate).toEqual(friday);
      expect(result.task.recurrenceAnchorDate).toEqual(monday);
    });

    it('subsequent: dueDate новый, якорь сброшен', async () => {
      repo.findById.mockResolvedValue(
        makeTask({
          recurrence: weekly,
          dueDate: wednesday,
          recurrenceAnchorDate: monday,
        }),
      );

      const result = await service.update(1, 'task-1', {
        dueDate: wednesday.toISOString(),
        rescheduleScope: 'subsequent',
      });

      expect(result.task.dueDate).toEqual(wednesday);
      expect(result.task.recurrenceAnchorDate).toBeNull();
    });

    it('subsequent с dueDate: daysOfWeek сдвигается на новый день', async () => {
      repo.findById.mockResolvedValue(
        makeTask({
          recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [1] },
          dueDate: monday,
          recurrenceAnchorDate: null,
        }),
      );

      const result = await service.update(1, 'task-1', {
        dueDate: wednesday.toISOString(),
        rescheduleScope: 'subsequent',
      });

      expect(result.task.recurrenceAnchorDate).toBeNull();
      expect(result.task.recurrence).toEqual(
        expect.objectContaining({ daysOfWeek: [3] }),
      );
    });

    it('subsequent без dueDate: только сбрасывает якорь', async () => {
      repo.findById.mockResolvedValue(
        makeTask({
          recurrence: weekly,
          dueDate: wednesday,
          recurrenceAnchorDate: monday,
        }),
      );

      const result = await service.update(1, 'task-1', {
        rescheduleScope: 'subsequent',
      });

      expect(result.task.dueDate).toEqual(wednesday);
      expect(result.task.recurrenceAnchorDate).toBeNull();
    });

    it('subsequent без dueDate: daysOfWeek сдвигается с якоря на dueDate', async () => {
      repo.findById.mockResolvedValue(
        makeTask({
          recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [1] },
          dueDate: wednesday,
          recurrenceAnchorDate: monday,
        }),
      );

      const result = await service.update(1, 'task-1', {
        rescheduleScope: 'subsequent',
      });

      expect(result.task.recurrenceAnchorDate).toBeNull();
      expect(result.task.recurrence).toEqual(
        expect.objectContaining({ daysOfWeek: [3] }),
      );
    });

    it('reschedule auto-created курсора не сбрасывает isAutoCreated', async () => {
      repo.findById.mockResolvedValue(
        makeTask({
          recurrence: weekly,
          dueDate: monday,
          recurringParentId: 'root-1',
          isAutoCreated: true,
        }),
      );

      const thisOnly = await service.update(1, 'task-1', {
        dueDate: wednesday.toISOString(),
        rescheduleScope: 'this',
      });
      expect(thisOnly.task.isAutoCreated).toBe(true);

      repo.findById.mockResolvedValue(thisOnly.task);
      const subsequent = await service.update(1, 'task-1', {
        rescheduleScope: 'subsequent',
      });
      expect(subsequent.task.isAutoCreated).toBe(true);
    });

    it('non-recurring PATCH dueDate не ставит якорь', async () => {
      repo.findById.mockResolvedValue(
        makeTask({ recurrence: null, dueDate: monday }),
      );

      const result = await service.update(1, 'task-1', {
        dueDate: wednesday.toISOString(),
      });

      expect(result.task.dueDate).toEqual(wednesday);
      expect(result.task.recurrenceAnchorDate).toBeNull();
    });
  });

  describe('materializeOccurrence', () => {
    const weekly: RecurrenceRule = { frequency: 'weekly', interval: 1 };
    const monday = new Date('2026-04-06T10:00:00.000Z');
    const nextMonday = new Date('2026-04-13T10:00:00.000Z');

    it('создаёт инстанс на слоте серии с isAutoCreated=false', async () => {
      const source = makeTask({
        id: 'root-1',
        recurrence: weekly,
        dueDate: monday,
        completed: false,
      });
      repo.findById.mockResolvedValue(source);
      repo.findByParentId.mockResolvedValue([source]);

      const result = await service.materializeOccurrence(1, 'root-1', {
        occurrenceDate: nextMonday.toISOString(),
      });

      expect(repo.create).toHaveBeenCalledTimes(1);
      const arg = repo.create.mock.calls[0][0] as Partial<Task>;
      expect(arg.dueDate).toEqual(nextMonday);
      expect(arg.isAutoCreated).toBe(false);
      expect(arg.recurringParentId).toBe('root-1');
      expect(arg.recurrenceAnchorDate).toBeNull();
      expect(result).toBeDefined();
    });

    it('completed root: проявляет слот по сетке первой машины', async () => {
      const source = makeTask({
        id: 'root-1',
        recurrence: weekly,
        dueDate: monday,
        completed: true,
        recurringCompletedCount: 1,
      });
      repo.findById.mockResolvedValue(source);
      repo.findByParentId.mockResolvedValue([]);

      await service.materializeOccurrence(1, 'root-1', {
        occurrenceDate: nextMonday.toISOString(),
      });

      expect(repo.create).toHaveBeenCalledTimes(1);
      const arg = repo.create.mock.calls[0][0] as Partial<Task>;
      expect(arg.dueDate).toEqual(nextMonday);
      expect(arg.isAutoCreated).toBe(false);
      expect(arg.recurringParentId).toBe('root-1');
    });

    it('повтор того же дня → 400', async () => {
      const source = makeTask({
        id: 'root-1',
        recurrence: weekly,
        dueDate: monday,
      });
      const existing = makeTask({
        id: 'mat-1',
        recurringParentId: 'root-1',
        dueDate: nextMonday,
      });
      repo.findById.mockResolvedValue(source);
      repo.findByParentId.mockResolvedValue([source, existing]);

      await expect(
        service.materializeOccurrence(1, 'root-1', {
          occurrenceDate: nextMonday.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('день не на сетке серии → 400', async () => {
      const source = makeTask({
        id: 'root-1',
        recurrence: weekly,
        dueDate: monday,
      });
      repo.findById.mockResolvedValue(source);
      repo.findByParentId.mockResolvedValue([source]);

      await expect(
        service.materializeOccurrence(1, 'root-1', {
          occurrenceDate: new Date('2026-04-08T10:00:00.000Z').toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updatePomodoroConfig', () => {
    it('обновляет конфиг при существующем', async () => {
      const config = makePomodoroConfig();
      repo.findById.mockResolvedValue(makeTask({ pomodoroConfig: config }));

      const result = await service.updatePomodoroConfig(1, 'task-1', {
        pomodoroCount: 8,
        pomodoroDuration: 50,
      });

      expect(repo.updatePomodoroConfig).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'task-1' }),
        { pomodoroCount: 8, pomodoroDuration: 50 },
      );
      expect(result.pomodoroConfig).toEqual(
        expect.objectContaining({
          pomodoroCount: 8,
          pomodoroDuration: 50,
        }),
      );
    });

    it('удаляет конфиг при null', async () => {
      const config = makePomodoroConfig();
      repo.findById.mockResolvedValue(makeTask({ pomodoroConfig: config }));

      const result = await service.updatePomodoroConfig(1, 'task-1', null);

      expect(repo.updatePomodoroConfig).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'task-1' }),
        null,
      );
      expect(result.pomodoroConfig).toBeNull();
    });

    it('создаёт конфиг если его не было', async () => {
      repo.findById.mockResolvedValue(makeTask({ pomodoroConfig: null }));

      const result = await service.updatePomodoroConfig(1, 'task-1', {
        pomodoroCount: 2,
      });

      expect(repo.updatePomodoroConfig).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'task-1', pomodoroConfig: null }),
        { pomodoroCount: 2 },
      );
      expect(result.pomodoroConfig).toEqual(
        expect.objectContaining({ pomodoroCount: 2 }),
      );
    });

    it('бросает NotFoundException для несуществующей задачи', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        service.updatePomodoroConfig(1, 'nope', { pomodoroCount: 4 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('incrementPomodoro', () => {
    it('вызывает increment с проверкой ownership', async () => {
      repo.findById.mockResolvedValue(makeTask());

      await service.incrementPomodoro(1, 'task-1', 1.0);

      expect(repo.findById).toHaveBeenCalledWith('task-1', 1);
      expect(repo.incrementPomodoroCompleted).toHaveBeenCalledWith(
        'task-1',
        1.0,
      );
    });

    it('передаёт дробные значения', async () => {
      repo.findById.mockResolvedValue(makeTask());

      await service.incrementPomodoro(1, 'task-1', 0.6);

      expect(repo.incrementPomodoroCompleted).toHaveBeenCalledWith(
        'task-1',
        0.6,
      );
    });

    it('бросает NotFoundException если задача не найдена', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.incrementPomodoro(1, 'nope', 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    // findById is read twice (before/after the increment); a third read happens
    // inside update() when the task auto-completes.
    const seedIncrement = (before: Task, after: Task) => {
      repo.findById
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after)
        .mockResolvedValue(after);
    };

    const pomodoroTask = (
      pomodoroCompleted: number,
      overrides: Partial<Task> = {},
    ) =>
      makeTask({
        pomodoroConfig: makePomodoroConfig({
          pomodoroCount: 4,
          pomodoroCompleted,
        }),
        ...overrides,
      });

    it('пересечение порога закрывает задачу', async () => {
      seedIncrement(pomodoroTask(3), pomodoroTask(4));

      const result = await service.incrementPomodoro(1, 'task-1', 1);

      expect(result.task.completed).toBe(true);
      expect(repo.save).toHaveBeenCalled();
    });

    it('порог не достигнут — возвращает свежий счётчик, не закрывая задачу', async () => {
      seedIncrement(pomodoroTask(3), pomodoroTask(3.6));

      const result = await service.incrementPomodoro(1, 'task-1', 0.6);

      expect(result.task.completed).toBe(false);
      expect(result.task.pomodoroConfig?.pomodoroCompleted).toBe(3.6);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('уже выполненная задача не закрывается повторно', async () => {
      seedIncrement(
        pomodoroTask(3, { completed: true }),
        pomodoroTask(4, { completed: true }),
      );

      await service.incrementPomodoro(1, 'task-1', 1);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('overdue задача не закрывается и не бросает', async () => {
      seedIncrement(
        pomodoroTask(3, { isOverdue: true }),
        pomodoroTask(4, { isOverdue: true }),
      );

      const result = await service.incrementPomodoro(1, 'task-1', 1);

      expect(result.task.completed).toBe(false);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('задача без pomodoroConfig не закрывается', async () => {
      seedIncrement(makeTask(), makeTask());

      const result = await service.incrementPomodoro(1, 'task-1', 1);

      expect(result.task.completed).toBe(false);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('recurring задача при пересечении порога порождает следующий instance', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-05T10:00:00.000Z'));

      const recurring = (pomodoroCompleted: number) =>
        pomodoroTask(pomodoroCompleted, {
          id: 'root-1',
          recurrence: { frequency: 'daily', interval: 1 } as RecurrenceRule,
          dueDate: new Date('2026-04-05T10:00:00.000Z'),
          recurringParentId: null,
          recurringCompletedCount: 0,
        });
      seedIncrement(recurring(3), recurring(4));

      const result = await service.incrementPomodoro(1, 'root-1', 1);

      expect(result.task.completed).toBe(true);
      expect(repo.create).toHaveBeenCalledTimes(1);
      const instanceArg = repo.create.mock.calls[0][0] as Partial<Task>;
      expect(instanceArg.recurringParentId).toBe('root-1');
      expect(instanceArg.pomodoroConfig?.pomodoroCompleted).toBe(0);
      expect(result.nextInstance).toBeDefined();

      jest.useRealTimers();
    });
  });

  describe('delete', () => {
    it('вызывает repo.delete', async () => {
      await service.delete(1, 'task-1');
      expect(repo.delete).toHaveBeenCalledWith('task-1', 1);
    });
  });

  // ── Recurring tasks ──────────────────────────────────────────────

  const dailyRule: RecurrenceRule = { frequency: 'daily', interval: 1 };

  describe('create — recurring задача', () => {
    it('создаёт задачу с recurrence полем', async () => {
      await service.create(1, {
        title: 'Recurring',
        dueDate: '2026-04-05T10:00:00.000Z',
        recurrence: dailyRule,
      });

      const arg = repo.create.mock.calls[0][0] as Partial<Task>;
      expect(arg.recurrence).toEqual(dailyRule);
    });

    it('recurringParentId = null для новой задачи (она — корень)', async () => {
      await service.create(1, {
        title: 'Recurring',
        dueDate: '2026-04-05T10:00:00.000Z',
        recurrence: dailyRule,
      });

      const arg = repo.create.mock.calls[0][0] as Partial<Task>;
      expect(arg.recurringParentId).toBeUndefined();
    });
  });

  describe('update — завершение recurring задачи', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-05T10:00:00.000Z'));
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    const rootTask = () =>
      makeTask({
        id: 'root-1',
        recurrence: dailyRule,
        dueDate: new Date('2026-04-05T10:00:00.000Z'),
        completed: false,
        recurringParentId: null,
        recurringCompletedCount: 0,
      });

    it('completed=true + recurrence -> создаёт новый instance с новым dueDate', async () => {
      const task = rootTask();
      repo.findById.mockResolvedValue(task);
      repo.findByParentId.mockResolvedValue([task]);

      const result = await service.update(1, 'root-1', { completed: true });

      expect(repo.create).toHaveBeenCalledTimes(1);
      const instanceArg = repo.create.mock.calls[0][0] as Partial<Task>;
      expect(instanceArg.dueDate).toEqual(new Date('2026-04-06T10:00:00.000Z'));
      expect(result.task.completed).toBe(true);
    });

    it('новый instance имеет recurringParentId = id корня', async () => {
      const task = rootTask();
      repo.findById.mockResolvedValue(task);
      repo.findByParentId.mockResolvedValue([task]);

      await service.update(1, 'root-1', { completed: true });

      const instanceArg = repo.create.mock.calls[0][0] as Partial<Task>;
      expect(instanceArg.recurringParentId).toBe('root-1');
    });

    it('новый instance имеет completed=false и isAutoCreated=true', async () => {
      const task = rootTask();
      repo.findById.mockResolvedValue(task);
      repo.findByParentId.mockResolvedValue([task]);

      await service.update(1, 'root-1', { completed: true });

      const instanceArg = repo.create.mock.calls[0][0] as Partial<Task>;
      expect(instanceArg.completed).toBe(false);
      expect(instanceArg.isAutoCreated).toBe(true);
    });

    it('recurringCompletedCount инкрементирован на ROOT задаче', async () => {
      const task = rootTask();
      repo.findById.mockResolvedValue(task);
      repo.findByParentId.mockResolvedValue([task]);

      await service.update(1, 'root-1', { completed: true });

      // save is called for the task with incremented count
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ recurringCompletedCount: 1 }),
      );
    });

    it('возвращает { task, nextInstance }', async () => {
      const task = rootTask();
      repo.findById.mockResolvedValue(task);
      repo.findByParentId.mockResolvedValue([task]);

      const result = await service.update(1, 'root-1', { completed: true });

      expect(result.task).toBeDefined();
      expect(result.nextInstance).toBeDefined();
    });

    it('instance задача: инкрементирует count на ROOT, не на instance', async () => {
      const root = rootTask();
      root.recurringCompletedCount = 2;

      const instance = makeTask({
        id: 'inst-1',
        recurrence: dailyRule,
        dueDate: new Date('2026-04-07T10:00:00.000Z'),
        completed: false,
        recurringParentId: 'root-1',
        recurringCompletedCount: 0,
      });

      repo.findById
        .mockResolvedValueOnce(instance) // find the instance being updated
        .mockResolvedValueOnce(root); // find the root for count update
      repo.findByParentId.mockResolvedValue([instance]);

      await service.update(1, 'inst-1', { completed: true });

      // Root's count should be saved as 3
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'root-1', recurringCompletedCount: 3 }),
      );
    });

    it('завершение задачи с dueDate в прошлом → next instance landing на сегодня', async () => {
      jest.setSystemTime(new Date('2026-04-29T10:00:00.000Z'));
      const task = makeTask({
        id: 'root-1',
        recurrence: dailyRule,
        dueDate: new Date('2026-04-05T10:00:00.000Z'), // 24 days in the past
        completed: false,
        recurringParentId: null,
        recurringCompletedCount: 0,
      });
      repo.findById.mockResolvedValue(task);
      repo.findByParentId.mockResolvedValue([task]);

      await service.update(1, 'root-1', { completed: true });

      const instanceArg = repo.create.mock.calls[0][0] as Partial<Task>;
      // For UTC user (default in spec mocks), startOfTodayLocal = 2026-04-29T00:00:00Z;
      // currentDue=April 5 10:00, daily rule → first valid >= April 29 00:00 is April 29 10:00.
      expect(instanceArg.dueDate).toEqual(new Date('2026-04-29T10:00:00.000Z'));
    });

    it('complete после this-only: next instance от якоря, не от сдвинутого dueDate', async () => {
      jest.setSystemTime(new Date('2026-04-08T15:00:00.000Z'));
      const task = makeTask({
        id: 'root-1',
        recurrence: { frequency: 'weekly', interval: 1 },
        dueDate: new Date('2026-04-08T15:00:00.000Z'),
        recurrenceAnchorDate: new Date('2026-04-06T10:00:00.000Z'),
        completed: false,
        recurringParentId: null,
        recurringCompletedCount: 0,
      });
      repo.findById.mockResolvedValue(task);
      repo.findByParentId.mockResolvedValue([task]);

      await service.update(1, 'root-1', { completed: true });

      const instanceArg = repo.create.mock.calls[0][0] as Partial<Task>;
      expect(instanceArg.dueDate).toEqual(new Date('2026-04-13T10:00:00.000Z'));
      expect(instanceArg.recurrenceAnchorDate).toBeNull();
    });

    it('complete после subsequent: next по новой сетке, не по исходной', async () => {
      jest.setSystemTime(new Date('2026-04-08T15:00:00.000Z'));
      const task = makeTask({
        id: 'inst-1',
        recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [3] },
        dueDate: new Date('2026-04-08T15:00:00.000Z'),
        recurrenceAnchorDate: null,
        completed: false,
        recurringParentId: 'root-1',
        isAutoCreated: false,
        recurringCompletedCount: 0,
      });
      const root = makeTask({
        id: 'root-1',
        recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [1] },
        dueDate: new Date('2026-04-06T10:00:00.000Z'),
        completed: true,
        recurringCompletedCount: 1,
      });
      repo.findById
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(root);
      repo.findByParentId.mockResolvedValue([task]);

      await service.update(1, 'inst-1', { completed: true });

      const instanceArg = repo.create.mock.calls[0][0] as Partial<Task>;
      expect(instanceArg.dueDate).toEqual(new Date('2026-04-15T15:00:00.000Z'));
      expect(instanceArg.recurrence).toEqual(
        expect.objectContaining({ daysOfWeek: [3] }),
      );
    });

    it('complete когда следующий слот проявлен: не create, count++, return occupying', async () => {
      const task = rootTask();
      const occupying = makeTask({
        id: 'mat-1',
        recurringParentId: 'root-1',
        dueDate: new Date('2026-04-06T10:00:00.000Z'),
        recurrence: dailyRule,
        isAutoCreated: false,
        completed: false,
      });
      repo.findById.mockResolvedValue(task);
      repo.findByParentId.mockResolvedValue([task, occupying]);

      const result = await service.update(1, 'root-1', { completed: true });

      expect(repo.create).not.toHaveBeenCalled();
      expect(result.nextInstance).toEqual(occupying);
      expect(result.task.recurringCompletedCount).toBe(1);
    });
  });

  describe('update — идемпотентность complete', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-05T10:00:00.000Z'));
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('повторный complete: findUncompletedInSeries находит существующий -> не создаёт дубликат', async () => {
      const task = makeTask({
        id: 'root-1',
        recurrence: dailyRule,
        dueDate: new Date('2026-04-05T10:00:00.000Z'),
        completed: false,
        recurringParentId: null,
      });
      const existingNext = makeTask({
        id: 'inst-1',
        recurringParentId: 'root-1',
        completed: false,
        dueDate: new Date('2026-04-06T10:00:00.000Z'),
        isAutoCreated: true,
      });

      repo.findById.mockResolvedValue(task);
      repo.findByParentId.mockResolvedValue([task, existingNext]);

      const result = await service.update(1, 'root-1', { completed: true });

      expect(repo.create).not.toHaveBeenCalled();
      expect(result.nextInstance).toEqual(existingNext);
      expect(result.task.recurringCompletedCount).toBe(0);
    });
  });

  describe('update — uncomplete recurring задачи (disconnect-семантика)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-05T10:00:00.000Z'));
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('X — root + N (autoCreated) -> X отключён, N повышен до root, count = X.count - 1', async () => {
      const task = makeTask({
        id: 'root-1',
        recurrence: dailyRule,
        completed: true,
        recurringParentId: null,
        recurringCompletedCount: 3,
      });
      const nextInstance = makeTask({
        id: 'inst-1',
        recurrence: dailyRule,
        recurringParentId: 'root-1',
        completed: false,
        isAutoCreated: true,
      });

      repo.findById.mockResolvedValue(task);
      repo.findByParentId.mockResolvedValue([nextInstance]);

      const result = await service.update(1, 'root-1', { completed: false });

      // X disconnected
      expect(result.task.recurrence).toBeNull();
      expect(result.task.recurringParentId).toBeNull();
      expect(result.task.recurringCompletedCount).toBe(0);
      expect(result.task.isAutoCreated).toBe(false);
      expect(result.task.completed).toBe(false);

      // N promoted
      expect(result.nextInstance).toBeDefined();
      expect(result.nextInstance!.id).toBe('inst-1');
      expect(result.nextInstance!.recurringParentId).toBeNull();
      expect(result.nextInstance!.recurringCompletedCount).toBe(2);
      expect(result.nextInstance!.isAutoCreated).toBe(false);

      // No deletion
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('X — root + N (user-modified) -> N всё равно повышен до root', async () => {
      const task = makeTask({
        id: 'root-1',
        recurrence: dailyRule,
        completed: true,
        recurringParentId: null,
        recurringCompletedCount: 1,
      });
      const nextInstance = makeTask({
        id: 'inst-1',
        recurrence: dailyRule,
        recurringParentId: 'root-1',
        completed: false,
        isAutoCreated: false,
      });

      repo.findById.mockResolvedValue(task);
      repo.findByParentId.mockResolvedValue([nextInstance]);

      const result = await service.update(1, 'root-1', { completed: false });

      expect(result.task.recurrence).toBeNull();
      expect(result.nextInstance).toBeDefined();
      expect(result.nextInstance!.recurringParentId).toBeNull();
      expect(result.nextInstance!.recurringCompletedCount).toBe(0);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('X — root, N нет -> X отключён, series мертв', async () => {
      const task = makeTask({
        id: 'root-1',
        recurrence: dailyRule,
        completed: true,
        recurringParentId: null,
        recurringCompletedCount: 1,
      });

      repo.findById.mockResolvedValue(task);
      repo.findByParentId.mockResolvedValue([]);

      const result = await service.update(1, 'root-1', { completed: false });

      expect(result.task.recurrence).toBeNull();
      expect(result.task.recurringParentId).toBeNull();
      expect(result.task.recurringCompletedCount).toBe(0);
      expect(result.task.completed).toBe(false);
      expect(result.nextInstance).toBeUndefined();
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('X — instance + N -> X отключён, root.count декрементится, N не трогаем', async () => {
      const root = makeTask({
        id: 'root-1',
        recurrence: dailyRule,
        completed: false,
        recurringParentId: null,
        recurringCompletedCount: 2,
      });
      const task = makeTask({
        id: 'inst-1',
        recurrence: dailyRule,
        completed: true,
        recurringParentId: 'root-1',
        recurringCompletedCount: 0,
        isAutoCreated: false,
      });
      const nextInstance = makeTask({
        id: 'inst-2',
        recurrence: dailyRule,
        recurringParentId: 'root-1',
        completed: false,
        isAutoCreated: true,
      });

      repo.findById
        .mockResolvedValueOnce(task) // initial findById in update()
        .mockResolvedValueOnce(root); // findById for root in uncompleteRecurringTask
      repo.findByParentId.mockResolvedValue([nextInstance]);

      const result = await service.update(1, 'inst-1', { completed: false });

      // X disconnected
      expect(result.task.recurrence).toBeNull();
      expect(result.task.recurringParentId).toBeNull();
      expect(result.task.completed).toBe(false);

      // Root's count decremented
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'root-1', recurringCompletedCount: 1 }),
      );

      // N untouched (not promoted, not saved with new parent)
      expect(repo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: 'inst-2', recurringParentId: null }),
      );
      expect(repo.delete).not.toHaveBeenCalled();
      expect(result.nextInstance).toBeUndefined();
    });

    it('X — instance, N нет -> X отключён, root.count декрементится', async () => {
      const root = makeTask({
        id: 'root-1',
        recurrence: dailyRule,
        completed: false,
        recurringParentId: null,
        recurringCompletedCount: 1,
      });
      const task = makeTask({
        id: 'inst-1',
        recurrence: dailyRule,
        completed: true,
        recurringParentId: 'root-1',
        isAutoCreated: false,
      });

      repo.findById.mockResolvedValueOnce(task).mockResolvedValueOnce(root);
      repo.findByParentId.mockResolvedValue([]);

      const result = await service.update(1, 'inst-1', { completed: false });

      expect(result.task.recurrence).toBeNull();
      expect(result.task.recurringParentId).toBeNull();
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'root-1', recurringCompletedCount: 0 }),
      );
      expect(result.nextInstance).toBeUndefined();
    });

    it('счётчик не уходит в минус (X.count=0)', async () => {
      const task = makeTask({
        id: 'root-1',
        recurrence: dailyRule,
        completed: true,
        recurringParentId: null,
        recurringCompletedCount: 0,
      });
      const nextInstance = makeTask({
        id: 'inst-1',
        recurrence: dailyRule,
        recurringParentId: 'root-1',
        completed: false,
        isAutoCreated: true,
      });

      repo.findById.mockResolvedValue(task);
      repo.findByParentId.mockResolvedValue([nextInstance]);

      const result = await service.update(1, 'root-1', { completed: false });

      expect(result.nextInstance!.recurringCompletedCount).toBe(0);
    });
  });

  describe('update — окончание серии', () => {
    it('endCount достигнут -> задача completed=true, nextInstance не создаётся', async () => {
      const task = makeTask({
        id: 'root-1',
        recurrence: { frequency: 'daily', interval: 1, endCount: 3 },
        dueDate: new Date('2026-04-05T10:00:00.000Z'),
        completed: false,
        recurringParentId: null,
        recurringCompletedCount: 2,
      });

      repo.findById.mockResolvedValue(task);
      repo.findByParentId.mockResolvedValue([task]);

      const result = await service.update(1, 'root-1', { completed: true });

      expect(repo.create).not.toHaveBeenCalled();
      expect(result.task.completed).toBe(true);
      expect(result.nextInstance).toBeUndefined();
    });

    it('endDate пройдена -> nextInstance не создаётся', async () => {
      const task = makeTask({
        id: 'root-1',
        recurrence: {
          frequency: 'daily',
          interval: 1,
          endDate: '2026-04-05T00:00:00.000Z',
        },
        dueDate: new Date('2026-04-05T10:00:00.000Z'),
        completed: false,
        recurringParentId: null,
      });

      repo.findById.mockResolvedValue(task);
      repo.findByParentId.mockResolvedValue([task]);

      const result = await service.update(1, 'root-1', { completed: true });

      expect(repo.create).not.toHaveBeenCalled();
      expect(result.nextInstance).toBeUndefined();
    });
  });

  describe('update — recurring негативные', () => {
    it('completed=true но нет recurrence -> обычное завершение, без instance', async () => {
      const task = makeTask({ id: 'task-1', completed: false });
      repo.findById.mockResolvedValue(task);

      const result = await service.update(1, 'task-1', { completed: true });

      expect(repo.create).not.toHaveBeenCalled();
      expect(result.task.completed).toBe(true);
    });

    it('completed=true + recurrence но нет dueDate -> завершить без instance', async () => {
      const task = makeTask({
        id: 'root-1',
        recurrence: dailyRule,
        dueDate: null,
        completed: false,
      });

      repo.findById.mockResolvedValue(task);

      const result = await service.update(1, 'root-1', { completed: true });

      expect(repo.create).not.toHaveBeenCalled();
      expect(result.task.completed).toBe(true);
    });

    it('обычная задача (без recurrence) + completed=false -> просто uncomplete', async () => {
      const task = makeTask({ id: 'task-1', completed: true });
      repo.findById.mockResolvedValue(task);

      const result = await service.update(1, 'task-1', { completed: false });

      expect(repo.findByParentId).not.toHaveBeenCalled();
      expect(result.task.completed).toBe(false);
    });
  });

  describe('delete — recurring задача', () => {
    it('удаление корня -> сносит uncompleted семьи и чистит parentId', async () => {
      const task = makeTask({
        id: 'root-1',
        recurrence: dailyRule,
        recurringParentId: null,
      });
      const child = makeTask({
        id: 'inst-1',
        recurrence: dailyRule,
        recurringParentId: 'root-1',
      });

      repo.findById.mockResolvedValue(task);
      repo.findByParentId
        .mockResolvedValueOnce([task, child])
        .mockResolvedValueOnce([task]);

      await service.delete(1, 'root-1');

      expect(repo.deleteByParentId).toHaveBeenCalledWith('root-1', true);
      expect(repo.clearParentId).toHaveBeenCalledWith('root-1');
      expect(repo.delete).toHaveBeenCalledWith('root-1', 1);
    });

    it('удаление не-последнего instance -> только эта строка', async () => {
      const root = makeTask({
        id: 'root-1',
        recurrence: dailyRule,
        recurringParentId: null,
        completed: true,
      });
      const inst = makeTask({
        id: 'inst-1',
        recurrence: dailyRule,
        recurringParentId: 'root-1',
      });
      const other = makeTask({
        id: 'inst-2',
        recurrence: dailyRule,
        recurringParentId: 'root-1',
      });

      repo.findById.mockResolvedValue(inst);
      repo.findByParentId.mockResolvedValue([root, inst, other]);

      await service.delete(1, 'inst-1');

      expect(repo.deleteByParentId).not.toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith('inst-1', 1);
    });

    it('удаление последнего live после completed root -> гасит recurrence у root', async () => {
      const root = makeTask({
        id: 'root-1',
        recurrence: dailyRule,
        recurringParentId: null,
        completed: true,
      });
      const inst = makeTask({
        id: 'inst-1',
        recurrence: dailyRule,
        recurringParentId: 'root-1',
      });

      repo.findById.mockResolvedValue(inst);
      repo.findByParentId
        .mockResolvedValueOnce([root, inst])
        .mockResolvedValueOnce([root]);

      const result = await service.delete(1, 'inst-1');

      expect(repo.deleteByParentId).toHaveBeenCalledWith('root-1', true);
      expect(repo.delete).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'root-1', recurrence: null }),
      );
      expect(result.deletedIds).toEqual(['inst-1']);
      expect(result.updated[0]).toEqual(
        expect.objectContaining({ id: 'root-1', recurrence: null }),
      );
    });

    it('удаление обычной задачи без recurrence -> НЕ вызывает deleteUncompletedInSeries', async () => {
      await service.delete(1, 'task-1');

      expect(repo.deleteByParentId).not.toHaveBeenCalled();
    });
  });
});
