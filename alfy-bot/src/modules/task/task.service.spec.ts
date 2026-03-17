import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskRepositoryPort } from './domain/task-repository.port';
import { Task, PomodoroConfig } from '../../shared/entities';

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
    deadline: null,
    location: null,
    tags: null,
    checklist: null,
    pomodoroConfig: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return task;
}

function makePomodoroConfig(overrides: Partial<PomodoroConfig> = {}): PomodoroConfig {
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
      create: jest.fn().mockImplementation((data) => Promise.resolve(makeTask(data))),
      update: jest.fn().mockImplementation((id, _userId, data) =>
        Promise.resolve(makeTask({ id, ...data })),
      ),
      delete: jest.fn().mockResolvedValue(true),
      incrementPomodoroCompleted: jest.fn().mockResolvedValue(undefined),
      updateChecklist: jest.fn().mockImplementation((task, data) =>
        Promise.resolve(makeTask({ ...task, checklist: data })),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: TaskRepositoryPort, useValue: repo },
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

      const config = repo.create.mock.calls[0][0].pomodoroConfig as PomodoroConfig;
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

      await service.update(1, 'task-1', { title: 'Новое название' });

      expect(repo.update).toHaveBeenCalledWith('task-1', 1, expect.objectContaining({
        title: 'Новое название',
      }));
    });

    it('бросает NotFoundException если задача не найдена', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.update(1, 'nope', { title: 'X' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('incrementPomodoro', () => {
    it('вызывает increment с проверкой ownership', async () => {
      repo.findById.mockResolvedValue(makeTask());

      await service.incrementPomodoro(1, 'task-1', 1.0);

      expect(repo.findById).toHaveBeenCalledWith('task-1', 1);
      expect(repo.incrementPomodoroCompleted).toHaveBeenCalledWith('task-1', 1.0);
    });

    it('передаёт дробные значения', async () => {
      repo.findById.mockResolvedValue(makeTask());

      await service.incrementPomodoro(1, 'task-1', 0.6);

      expect(repo.incrementPomodoroCompleted).toHaveBeenCalledWith('task-1', 0.6);
    });

    it('бросает NotFoundException если задача не найдена', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.incrementPomodoro(1, 'nope', 1))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('вызывает repo.delete', async () => {
      await service.delete(1, 'task-1');
      expect(repo.delete).toHaveBeenCalledWith('task-1', 1);
    });
  });
});
