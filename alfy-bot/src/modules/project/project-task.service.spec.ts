import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ProjectTaskService } from './project-task.service';
import { ProjectRepositoryPort } from './domain/project-repository.port';
import { ProjectColumnRepositoryPort } from './domain/project-column-repository.port';
import { TaskRepositoryPort } from '../task/domain/task-repository.port';
import { Project, ProjectColumn, Task } from '../../shared/entities';

function makeProject(overrides: Partial<Project> = {}): Project {
  const p = new Project();
  Object.assign(p, {
    id: 'proj-1',
    userId: 1,
    parentId: null,
    title: 'Проект',
    description: null,
    viewMode: 'board' as const,
    icon: null,
    color: null,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    columns: [],
    children: [],
    ...overrides,
  });
  return p;
}

function makeColumn(overrides: Partial<ProjectColumn> = {}): ProjectColumn {
  const c = new ProjectColumn();
  Object.assign(c, {
    id: 'col-1',
    projectId: 'proj-1',
    title: 'To Do',
    order: 0,
    color: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return c;
}

function makeTask(overrides: Partial<Task> = {}): Task {
  const t = new Task();
  Object.assign(t, {
    id: 'task-1',
    userId: 1,
    title: 'Задача',
    description: null,
    completed: false,
    priority: null,
    dueDate: null,
    deadline: null,
    location: null,
    tags: null,
    checklist: null,
    projectId: null,
    columnId: null,
    order: 0,
    pomodoroConfig: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return t;
}

describe('ProjectTaskService — move & reorder', () => {
  let service: ProjectTaskService;
  let projRepo: Record<string, jest.Mock>;
  let colRepo: Record<string, jest.Mock>;
  let taskRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    projRepo = {
      findAllByUser: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      findByIdWithRelations: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      reorder: jest.fn(),
    };

    colRepo = {
      findAllByProject: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      reorder: jest.fn(),
    };

    taskRepo = {
      findAllByUser: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      incrementPomodoroCompleted: jest.fn(),
      updateChecklist: jest.fn(),
      updatePomodoroConfig: jest.fn(),
      findAllByProject: jest.fn().mockResolvedValue([]),
      updatePosition: jest
        .fn()
        .mockImplementation((taskId, _userId, projectId, columnId, order) =>
          Promise.resolve(makeTask({ id: taskId, projectId, columnId, order })),
        ),
      reorderTasks: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectTaskService,
        { provide: ProjectRepositoryPort, useValue: projRepo },
        { provide: ProjectColumnRepositoryPort, useValue: colRepo },
        { provide: TaskRepositoryPort, useValue: taskRepo },
      ],
    }).compile();

    service = module.get(ProjectTaskService);
  });

  // ── moveTask ────────────────────────────────────────────────────

  describe('moveTask', () => {
    it('перемещает задачу в проект', async () => {
      taskRepo.findById.mockResolvedValue(makeTask());
      projRepo.findById.mockResolvedValue(makeProject({ viewMode: 'list' }));

      const result = await service.moveTask(1, 'proj-1', 'task-1', {
        projectId: 'proj-1',
        order: 0,
      });

      expect(taskRepo.updatePosition).toHaveBeenCalledWith(
        'task-1',
        1,
        'proj-1',
        null,
        0,
      );
    });

    it('перемещает задачу из проекта во Входящие (projectId=null)', async () => {
      taskRepo.findById.mockResolvedValue(makeTask({ projectId: 'proj-1' }));
      projRepo.findById.mockResolvedValue(makeProject());

      await service.moveTask(1, 'proj-1', 'task-1', {
        projectId: null,
        order: 0,
      });

      expect(taskRepo.updatePosition).toHaveBeenCalledWith(
        'task-1',
        1,
        null,
        null,
        0,
      );
    });

    it('перемещает задачу в колонку на доске', async () => {
      taskRepo.findById.mockResolvedValue(makeTask());
      projRepo.findById.mockResolvedValue(makeProject({ viewMode: 'board' }));
      colRepo.findById.mockResolvedValue(makeColumn());

      await service.moveTask(1, 'proj-1', 'task-1', {
        projectId: 'proj-1',
        columnId: 'col-1',
        order: 2,
      });

      expect(taskRepo.updatePosition).toHaveBeenCalledWith(
        'task-1',
        1,
        'proj-1',
        'col-1',
        2,
      );
    });

    it('перемещает задачу между колонками одного проекта', async () => {
      taskRepo.findById.mockResolvedValue(
        makeTask({ projectId: 'proj-1', columnId: 'col-1' }),
      );
      projRepo.findById.mockResolvedValue(makeProject());
      colRepo.findById.mockResolvedValue(makeColumn({ id: 'col-2' }));

      await service.moveTask(1, 'proj-1', 'task-1', {
        projectId: 'proj-1',
        columnId: 'col-2',
        order: 0,
      });

      expect(taskRepo.updatePosition).toHaveBeenCalledWith(
        'task-1',
        1,
        'proj-1',
        'col-2',
        0,
      );
    });

    it('устанавливает order при перемещении', async () => {
      taskRepo.findById.mockResolvedValue(makeTask());
      projRepo.findById.mockResolvedValue(makeProject({ viewMode: 'list' }));

      await service.moveTask(1, 'proj-1', 'task-1', {
        projectId: 'proj-1',
        order: 5,
      });

      expect(taskRepo.updatePosition).toHaveBeenCalledWith(
        'task-1',
        1,
        'proj-1',
        null,
        5,
      );
    });

    it('бросает NotFoundException если taskId не существует', async () => {
      projRepo.findById.mockResolvedValue(makeProject());

      await expect(
        service.moveTask(1, 'proj-1', 'nope', { order: 0 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('бросает NotFoundException если целевой projectId не существует', async () => {
      taskRepo.findById.mockResolvedValue(makeTask());
      projRepo.findById.mockImplementation((id: string) =>
        Promise.resolve(id === 'proj-1' ? makeProject() : null),
      );

      await expect(
        service.moveTask(1, 'proj-1', 'task-1', {
          projectId: 'nope',
          order: 0,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('бросает NotFoundException если columnId не существует', async () => {
      taskRepo.findById.mockResolvedValue(makeTask());
      projRepo.findById.mockResolvedValue(makeProject());

      await expect(
        service.moveTask(1, 'proj-1', 'task-1', {
          projectId: 'proj-1',
          columnId: 'nope',
          order: 0,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('бросает ForbiddenException если задача принадлежит другому пользователю', async () => {
      taskRepo.findById.mockResolvedValue(null);
      projRepo.findById.mockResolvedValue(makeProject());

      await expect(
        service.moveTask(1, 'proj-1', 'task-1', { order: 0 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('бросает ForbiddenException если проект принадлежит другому пользователю', async () => {
      taskRepo.findById.mockResolvedValue(makeTask());
      projRepo.findById.mockResolvedValue(makeProject({ userId: 999 }));

      await expect(
        service.moveTask(1, 'proj-1', 'task-1', { order: 0 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('бросает BadRequestException если columnId принадлежит другому проекту', async () => {
      taskRepo.findById.mockResolvedValue(makeTask());
      projRepo.findById.mockResolvedValue(makeProject());
      colRepo.findById.mockResolvedValue(null); // not found in this project

      await expect(
        service.moveTask(1, 'proj-1', 'task-1', {
          projectId: 'proj-1',
          columnId: 'col-other',
          order: 0,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('бросает BadRequestException если columnId указан но projectId=null', async () => {
      taskRepo.findById.mockResolvedValue(makeTask());
      projRepo.findById.mockResolvedValue(makeProject());

      await expect(
        service.moveTask(1, 'proj-1', 'task-1', {
          projectId: null,
          columnId: 'col-1',
          order: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('бросает BadRequestException если columnId указан но проект в viewMode=list', async () => {
      taskRepo.findById.mockResolvedValue(makeTask());
      projRepo.findById.mockResolvedValue(makeProject({ viewMode: 'list' }));

      await expect(
        service.moveTask(1, 'proj-1', 'task-1', {
          projectId: 'proj-1',
          columnId: 'col-1',
          order: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('бросает BadRequestException если order отрицательный', async () => {
      taskRepo.findById.mockResolvedValue(makeTask());
      projRepo.findById.mockResolvedValue(makeProject());

      await expect(
        service.moveTask(1, 'proj-1', 'task-1', {
          projectId: 'proj-1',
          order: -1,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── reorderTasks ────────────────────────────────────────────────

  describe('reorderTasks', () => {
    it('обновляет порядок задач по переданным ID', async () => {
      projRepo.findById.mockResolvedValue(makeProject());

      await service.reorderTasks(1, 'proj-1', {
        orderedIds: ['task-3', 'task-1', 'task-2'],
      });

      expect(taskRepo.reorderTasks).toHaveBeenCalledWith([
        { id: 'task-3', order: 0 },
        { id: 'task-1', order: 1 },
        { id: 'task-2', order: 2 },
      ]);
    });

    it('обновляет порядок задач внутри колонки', async () => {
      projRepo.findById.mockResolvedValue(makeProject());

      await service.reorderTasks(1, 'proj-1', {
        orderedIds: ['task-2', 'task-1'],
        columnId: 'col-1',
      });

      expect(taskRepo.reorderTasks).toHaveBeenCalledWith([
        { id: 'task-2', order: 0 },
        { id: 'task-1', order: 1 },
      ]);
    });

    it('бросает BadRequestException если массив пустой', async () => {
      projRepo.findById.mockResolvedValue(makeProject());

      await expect(
        service.reorderTasks(1, 'proj-1', { orderedIds: [] }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
