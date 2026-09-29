import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SprintService } from './sprint.service';
import { SprintRepositoryPort } from './domain/sprint-repository.port';
import { ProjectRepositoryPort } from './domain/project-repository.port';
import { Project, Sprint } from '../../shared/entities';

function makeProject(overrides: Partial<Project> = {}): Project {
  const p = new Project();
  Object.assign(p, {
    id: 'proj-1',
    userId: 1,
    title: 'Проект',
    ...overrides,
  });
  return p;
}

function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  const s = new Sprint();
  Object.assign(s, {
    id: 'sprint-1',
    userId: 1,
    projectId: 'proj-1',
    name: 'Спринт 1',
    goal: null,
    startDate: null,
    endDate: null,
    status: 'planned' as const,
    completedAt: null,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return s;
}

const SPRINT_2 = '11111111-1111-4111-8111-111111111111';

describe('SprintService', () => {
  let service: SprintService;
  let sprintRepo: Record<string, jest.Mock>;
  let projRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    sprintRepo = {
      findAllByProject: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      findActive: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation((data) => Promise.resolve(makeSprint(data))),
      save: jest.fn().mockImplementation((sprint) => Promise.resolve(sprint)),
      delete: jest.fn().mockResolvedValue(true),
      closeAndMoveUnfinished: jest.fn().mockResolvedValue(undefined),
    };

    projRepo = {
      findAllByUser: jest.fn(),
      findById: jest.fn().mockResolvedValue(makeProject()),
      findByIdWithRelations: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SprintService,
        { provide: SprintRepositoryPort, useValue: sprintRepo },
        { provide: ProjectRepositoryPort, useValue: projRepo },
      ],
    }).compile();

    service = module.get(SprintService);
  });

  describe('доступ к проекту', () => {
    it('бросает NotFoundException, если проект не найден', async () => {
      projRepo.findById.mockResolvedValue(null);
      await expect(service.list(1, 'nope')).rejects.toThrow(NotFoundException);
      await expect(service.create(1, 'nope', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('бросает ForbiddenException, если проект чужой', async () => {
      projRepo.findById.mockResolvedValue(makeProject({ userId: 2 }));
      await expect(service.list(1, 'proj-1')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.delete(1, 'proj-1', 'sprint-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('list', () => {
    it('отдаёт все спринты проекта, включая закрытые', async () => {
      const sprints = [
        makeSprint({ id: 'a', status: 'closed' }),
        makeSprint({ id: 'b', status: 'active' }),
      ];
      sprintRepo.findAllByProject.mockResolvedValue(sprints);

      await expect(service.list(1, 'proj-1')).resolves.toEqual(sprints);
      expect(sprintRepo.findAllByProject).toHaveBeenCalledWith('proj-1');
    });
  });

  describe('create', () => {
    it('даёт имя «Спринт N», где N — число всех спринтов проекта + 1, а order — следующий после максимального незакрытого', async () => {
      sprintRepo.findAllByProject.mockResolvedValue([
        makeSprint({ id: 'a', status: 'closed', order: 5 }),
        makeSprint({ id: 'b', status: 'active', order: 0 }),
        makeSprint({ id: 'c', status: 'planned', order: 1 }),
      ]);

      await service.create(1, 'proj-1', {});

      expect(sprintRepo.create).toHaveBeenCalledWith({
        userId: 1,
        projectId: 'proj-1',
        name: 'Спринт 4',
        goal: null,
        order: 2,
      });
    });

    it('после удаления спринтов из середины новый встаёт в конец очереди, а не перед старыми', async () => {
      sprintRepo.findAllByProject.mockResolvedValue([
        makeSprint({ id: 'c', status: 'planned', order: 2 }),
        makeSprint({ id: 'd', status: 'planned', order: 3 }),
      ]);

      await service.create(1, 'proj-1', {});

      expect(sprintRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ order: 4 }),
      );
    });

    it('сохраняет явно заданные имя и цель', async () => {
      await service.create(1, 'proj-1', { name: 'Релиз', goal: 'Выпустить' });

      expect(sprintRepo.create).toHaveBeenCalledWith({
        userId: 1,
        projectId: 'proj-1',
        name: 'Релиз',
        goal: 'Выпустить',
        order: 0,
      });
    });
  });

  describe('update', () => {
    it('бросает NotFoundException, если спринта нет', async () => {
      await expect(service.update(1, 'proj-1', 'x', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('запрещает менять закрытый спринт', async () => {
      sprintRepo.findById.mockResolvedValue(makeSprint({ status: 'closed' }));
      await expect(
        service.update(1, 'proj-1', 'sprint-1', { name: 'Новое' }),
      ).rejects.toThrow(BadRequestException);
      expect(sprintRepo.save).not.toHaveBeenCalled();
    });

    it('обновляет переданные поля и оставляет остальные', async () => {
      sprintRepo.findById.mockResolvedValue(
        makeSprint({ goal: 'старая цель' }),
      );

      const result = await service.update(1, 'proj-1', 'sprint-1', {
        name: 'Новое',
        startDate: '2026-01-01',
      });

      expect(result.name).toBe('Новое');
      expect(result.goal).toBe('старая цель');
      expect(result.startDate).toBe('2026-01-01');
    });

    it('позволяет обнулить цель и даты', async () => {
      sprintRepo.findById.mockResolvedValue(
        makeSprint({
          goal: 'цель',
          startDate: '2026-01-01',
          endDate: '2026-01-14',
        }),
      );

      const result = await service.update(1, 'proj-1', 'sprint-1', {
        goal: null,
        startDate: null,
        endDate: null,
      });

      expect(result.goal).toBeNull();
      expect(result.startDate).toBeNull();
      expect(result.endDate).toBeNull();
    });

    it('отклоняет startDate позже endDate', async () => {
      sprintRepo.findById.mockResolvedValue(makeSprint());
      await expect(
        service.update(1, 'proj-1', 'sprint-1', {
          startDate: '2026-02-01',
          endDate: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('сверяет новую дату с уже сохранённой второй датой', async () => {
      sprintRepo.findById.mockResolvedValue(
        makeSprint({ startDate: '2026-01-10', endDate: '2026-01-20' }),
      );
      await expect(
        service.update(1, 'proj-1', 'sprint-1', { endDate: '2026-01-05' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update(1, 'proj-1', 'sprint-1', { startDate: '2026-01-25' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('start', () => {
    const dto = {
      startDate: '2026-01-01',
      endDate: '2026-01-14',
      goal: 'Цель',
    };

    it('переводит planned в active с датами и целью', async () => {
      sprintRepo.findById.mockResolvedValue(makeSprint());

      const result = await service.start(1, 'proj-1', 'sprint-1', dto);

      expect(result.status).toBe('active');
      expect(result.startDate).toBe('2026-01-01');
      expect(result.endDate).toBe('2026-01-14');
      expect(result.goal).toBe('Цель');
      expect(sprintRepo.save).toHaveBeenCalled();
    });

    it('не трогает цель, если она не передана', async () => {
      sprintRepo.findById.mockResolvedValue(makeSprint({ goal: 'была' }));

      const result = await service.start(1, 'proj-1', 'sprint-1', {
        startDate: '2026-01-01',
        endDate: '2026-01-14',
      });

      expect(result.goal).toBe('была');
    });

    it('бросает 400, если в проекте уже есть активный спринт', async () => {
      sprintRepo.findById.mockResolvedValue(makeSprint());
      sprintRepo.findActive.mockResolvedValue(
        makeSprint({ id: 'other', status: 'active' }),
      );

      await expect(service.start(1, 'proj-1', 'sprint-1', dto)).rejects.toThrow(
        'Another sprint is already active',
      );
      expect(sprintRepo.save).not.toHaveBeenCalled();
    });

    it.each(['active', 'closed'] as const)(
      'бросает 400 при запуске спринта в статусе %s',
      async (status) => {
        sprintRepo.findById.mockResolvedValue(makeSprint({ status }));
        await expect(
          service.start(1, 'proj-1', 'sprint-1', dto),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it('бросает 400, если startDate позже endDate', async () => {
      sprintRepo.findById.mockResolvedValue(makeSprint());
      await expect(
        service.start(1, 'proj-1', 'sprint-1', {
          startDate: '2026-02-01',
          endDate: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('бросает NotFoundException, если спринта нет', async () => {
      await expect(service.start(1, 'proj-1', 'x', dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('complete', () => {
    beforeEach(() => {
      sprintRepo.findById.mockImplementation((id: string) => {
        if (id === 'sprint-1')
          return Promise.resolve(makeSprint({ status: 'active' }));
        if (id === SPRINT_2)
          return Promise.resolve(makeSprint({ id: SPRINT_2 }));
        return Promise.resolve(null);
      });
    });

    it('moveTo=backlog закрывает спринт и переносит незавершённые в бэклог', async () => {
      await service.complete(1, 'proj-1', 'sprint-1', { moveTo: 'backlog' });

      expect(sprintRepo.closeAndMoveUnfinished).toHaveBeenCalledWith(
        'sprint-1',
        null,
      );
    });

    it('moveTo=<planned-спринт> переносит незавершённые в него', async () => {
      await service.complete(1, 'proj-1', 'sprint-1', { moveTo: SPRINT_2 });

      expect(sprintRepo.closeAndMoveUnfinished).toHaveBeenCalledWith(
        'sprint-1',
        SPRINT_2,
      );
      expect(sprintRepo.findById).toHaveBeenCalledWith(SPRINT_2, 'proj-1');
    });

    it('возвращает обновлённый закрытый спринт', async () => {
      const closed = makeSprint({ status: 'closed' });
      sprintRepo.findById
        .mockResolvedValueOnce(makeSprint({ status: 'active' }))
        .mockResolvedValueOnce(closed);

      await expect(
        service.complete(1, 'proj-1', 'sprint-1', { moveTo: 'backlog' }),
      ).resolves.toBe(closed);
    });

    it.each(['planned', 'closed'] as const)(
      'бросает 400 при завершении спринта в статусе %s',
      async (status) => {
        sprintRepo.findById.mockResolvedValue(makeSprint({ status }));
        await expect(
          service.complete(1, 'proj-1', 'sprint-1', { moveTo: 'backlog' }),
        ).rejects.toThrow(BadRequestException);
        expect(sprintRepo.closeAndMoveUnfinished).not.toHaveBeenCalled();
      },
    );

    it.each(['active', 'closed'] as const)(
      'бросает 400, если moveTo указывает на спринт в статусе %s',
      async (status) => {
        sprintRepo.findById.mockImplementation((id: string) =>
          Promise.resolve(
            id === 'sprint-1'
              ? makeSprint({ status: 'active' })
              : makeSprint({ id, status }),
          ),
        );
        await expect(
          service.complete(1, 'proj-1', 'sprint-1', { moveTo: SPRINT_2 }),
        ).rejects.toThrow(BadRequestException);
        expect(sprintRepo.closeAndMoveUnfinished).not.toHaveBeenCalled();
      },
    );

    it('бросает 400, если moveTo — чужой или несуществующий спринт', async () => {
      await expect(
        service.complete(1, 'proj-1', 'sprint-1', {
          moveTo: '22222222-2222-4222-8222-222222222222',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(sprintRepo.closeAndMoveUnfinished).not.toHaveBeenCalled();
    });

    it('бросает NotFoundException, если завершаемого спринта нет', async () => {
      await expect(
        service.complete(1, 'proj-1', 'x', { moveTo: 'backlog' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('удаляет спринт', async () => {
      await service.delete(1, 'proj-1', 'sprint-1');
      expect(sprintRepo.delete).toHaveBeenCalledWith('sprint-1', 'proj-1');
    });

    it('бросает NotFoundException, если спринта нет', async () => {
      sprintRepo.delete.mockResolvedValue(false);
      await expect(service.delete(1, 'proj-1', 'x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
