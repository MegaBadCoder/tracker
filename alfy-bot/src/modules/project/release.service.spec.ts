import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ReleaseService } from './release.service';
import { ReleaseRepositoryPort } from './domain/release-repository.port';
import { ProjectRepositoryPort } from './domain/project-repository.port';
import { BoardGroupRepositoryPort } from './domain/board-group-repository.port';
import { BoardGroup, Project, Release } from '../../shared/entities';

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

function makeRelease(overrides: Partial<Release> = {}): Release {
  const r = new Release();
  Object.assign(r, {
    id: 'release-1',
    userId: 1,
    projectId: 'proj-1',
    name: 'Релиз 1.0',
    description: null,
    startDate: null,
    releaseDate: null,
    status: 'planned' as const,
    releasedAt: null,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return r;
}

function makeGroup(overrides: Partial<BoardGroup> = {}): BoardGroup {
  const g = new BoardGroup();
  Object.assign(g, {
    id: 'group-1',
    userId: 1,
    projectId: 'proj-1',
    parentId: null,
    type: 'epic' as const,
    title: 'Эпик',
    ...overrides,
  });
  return g;
}

const RELEASE_2 = '11111111-1111-4111-8111-111111111111';

describe('ReleaseService', () => {
  let service: ReleaseService;
  let releaseRepo: Record<string, jest.Mock>;
  let projRepo: Record<string, jest.Mock>;
  let groupRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    releaseRepo = {
      findAllByProject: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation((data) => Promise.resolve(makeRelease(data))),
      save: jest.fn().mockImplementation((release) => Promise.resolve(release)),
      delete: jest.fn().mockResolvedValue(true),
      releaseAndMoveUnfinished: jest.fn().mockResolvedValue(undefined),
      assignGroupTasks: jest.fn().mockResolvedValue(0),
      setGroupRelease: jest.fn().mockResolvedValue(0),
    };

    projRepo = {
      findAllByUser: jest.fn(),
      findById: jest.fn().mockResolvedValue(makeProject()),
      findByIdWithRelations: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    groupRepo = {
      findAllByProject: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      countChildren: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      reorder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReleaseService,
        { provide: ReleaseRepositoryPort, useValue: releaseRepo },
        { provide: ProjectRepositoryPort, useValue: projRepo },
        { provide: BoardGroupRepositoryPort, useValue: groupRepo },
      ],
    }).compile();

    service = module.get(ReleaseService);
  });

  describe('доступ к проекту', () => {
    it('бросает NotFoundException, если проект не найден', async () => {
      projRepo.findById.mockResolvedValue(null);
      await expect(service.list(1, 'nope')).rejects.toThrow(NotFoundException);
      await expect(service.create(1, 'nope', { name: 'R' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('бросает ForbiddenException, если проект чужой', async () => {
      projRepo.findById.mockResolvedValue(makeProject({ userId: 2 }));
      await expect(service.list(1, 'proj-1')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.delete(1, 'proj-1', 'release-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('list', () => {
    it('отдаёт все релизы проекта, включая выпущенные', async () => {
      const releases = [
        makeRelease({ id: 'a', status: 'released' }),
        makeRelease({ id: 'b' }),
      ];
      releaseRepo.findAllByProject.mockResolvedValue(releases);

      await expect(service.list(1, 'proj-1')).resolves.toEqual(releases);
      expect(releaseRepo.findAllByProject).toHaveBeenCalledWith('proj-1');
    });
  });

  describe('create', () => {
    it('order — следующий после максимального среди planned', async () => {
      releaseRepo.findAllByProject.mockResolvedValue([
        makeRelease({ id: 'a', status: 'released', order: 5 }),
        makeRelease({ id: 'b', order: 0 }),
        makeRelease({ id: 'c', order: 1 }),
      ]);

      await service.create(1, 'proj-1', { name: 'Релиз 2.0' });

      expect(releaseRepo.create).toHaveBeenCalledWith({
        userId: 1,
        projectId: 'proj-1',
        name: 'Релиз 2.0',
        description: null,
        startDate: null,
        releaseDate: null,
        order: 2,
      });
    });

    it('order = 0, если planned-релизов нет', async () => {
      releaseRepo.findAllByProject.mockResolvedValue([
        makeRelease({ id: 'a', status: 'released', order: 3 }),
      ]);

      await service.create(1, 'proj-1', { name: 'Первый' });

      expect(releaseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ order: 0 }),
      );
    });

    it('сохраняет описание и даты', async () => {
      await service.create(1, 'proj-1', {
        name: 'Релиз',
        description: 'Описание',
        startDate: '2026-01-01',
        releaseDate: '2026-01-31',
      });

      expect(releaseRepo.create).toHaveBeenCalledWith({
        userId: 1,
        projectId: 'proj-1',
        name: 'Релиз',
        description: 'Описание',
        startDate: '2026-01-01',
        releaseDate: '2026-01-31',
        order: 0,
      });
    });

    it('отклоняет startDate позже releaseDate', async () => {
      await expect(
        service.create(1, 'proj-1', {
          name: 'Релиз',
          startDate: '2026-02-01',
          releaseDate: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(releaseRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('бросает NotFoundException, если релиза нет', async () => {
      await expect(service.update(1, 'proj-1', 'x', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('запрещает менять выпущенный релиз', async () => {
      releaseRepo.findById.mockResolvedValue(
        makeRelease({ status: 'released' }),
      );
      await expect(
        service.update(1, 'proj-1', 'release-1', { name: 'Новое' }),
      ).rejects.toThrow(BadRequestException);
      expect(releaseRepo.save).not.toHaveBeenCalled();
    });

    it('обновляет переданные поля и оставляет остальные', async () => {
      releaseRepo.findById.mockResolvedValue(
        makeRelease({ description: 'старое описание' }),
      );

      const result = await service.update(1, 'proj-1', 'release-1', {
        name: 'Новое',
        startDate: '2026-01-01',
      });

      expect(result.name).toBe('Новое');
      expect(result.description).toBe('старое описание');
      expect(result.startDate).toBe('2026-01-01');
    });

    it('позволяет обнулить описание и даты', async () => {
      releaseRepo.findById.mockResolvedValue(
        makeRelease({
          description: 'описание',
          startDate: '2026-01-01',
          releaseDate: '2026-01-14',
        }),
      );

      const result = await service.update(1, 'proj-1', 'release-1', {
        description: null,
        startDate: null,
        releaseDate: null,
      });

      expect(result.description).toBeNull();
      expect(result.startDate).toBeNull();
      expect(result.releaseDate).toBeNull();
    });

    it('отклоняет startDate позже releaseDate', async () => {
      releaseRepo.findById.mockResolvedValue(makeRelease());
      await expect(
        service.update(1, 'proj-1', 'release-1', {
          startDate: '2026-02-01',
          releaseDate: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('сверяет новую дату с уже сохранённой второй датой', async () => {
      releaseRepo.findById.mockResolvedValue(
        makeRelease({ startDate: '2026-01-10', releaseDate: '2026-01-20' }),
      );
      await expect(
        service.update(1, 'proj-1', 'release-1', {
          releaseDate: '2026-01-05',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update(1, 'proj-1', 'release-1', { startDate: '2026-01-25' }),
      ).rejects.toThrow(BadRequestException);
      expect(releaseRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('release', () => {
    beforeEach(() => {
      releaseRepo.findById.mockImplementation((id: string) => {
        if (id === 'release-1') return Promise.resolve(makeRelease());
        if (id === RELEASE_2)
          return Promise.resolve(makeRelease({ id: RELEASE_2 }));
        return Promise.resolve(null);
      });
    });

    it('moveTo=none выпускает релиз и снимает релиз с незавершённых задач', async () => {
      await service.release(1, 'proj-1', 'release-1', { moveTo: 'none' });

      expect(releaseRepo.releaseAndMoveUnfinished).toHaveBeenCalledWith(
        'release-1',
        null,
      );
    });

    it('moveTo=<planned-релиз> переносит незавершённые в него', async () => {
      await service.release(1, 'proj-1', 'release-1', { moveTo: RELEASE_2 });

      expect(releaseRepo.releaseAndMoveUnfinished).toHaveBeenCalledWith(
        'release-1',
        RELEASE_2,
      );
      expect(releaseRepo.findById).toHaveBeenCalledWith(RELEASE_2, 'proj-1');
    });

    it('возвращает обновлённый выпущенный релиз', async () => {
      const released = makeRelease({ status: 'released' });
      releaseRepo.findById
        .mockResolvedValueOnce(makeRelease())
        .mockResolvedValueOnce(released);

      await expect(
        service.release(1, 'proj-1', 'release-1', { moveTo: 'none' }),
      ).resolves.toBe(released);
    });

    it('бросает 400 при выпуске уже выпущенного релиза', async () => {
      releaseRepo.findById.mockResolvedValue(
        makeRelease({ status: 'released' }),
      );
      await expect(
        service.release(1, 'proj-1', 'release-1', { moveTo: 'none' }),
      ).rejects.toThrow(BadRequestException);
      expect(releaseRepo.releaseAndMoveUnfinished).not.toHaveBeenCalled();
    });

    it('бросает 400, если moveTo указывает на сам релиз', async () => {
      await expect(
        service.release(1, 'proj-1', 'release-1', { moveTo: 'release-1' }),
      ).rejects.toThrow(BadRequestException);
      expect(releaseRepo.releaseAndMoveUnfinished).not.toHaveBeenCalled();
    });

    it('бросает 400, если moveTo указывает на выпущенный релиз', async () => {
      releaseRepo.findById.mockImplementation((id: string) =>
        Promise.resolve(
          id === 'release-1'
            ? makeRelease()
            : makeRelease({ id, status: 'released' }),
        ),
      );
      await expect(
        service.release(1, 'proj-1', 'release-1', { moveTo: RELEASE_2 }),
      ).rejects.toThrow(BadRequestException);
      expect(releaseRepo.releaseAndMoveUnfinished).not.toHaveBeenCalled();
    });

    it('бросает 400, если moveTo — чужой или несуществующий релиз', async () => {
      await expect(
        service.release(1, 'proj-1', 'release-1', {
          moveTo: '22222222-2222-4222-8222-222222222222',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(releaseRepo.releaseAndMoveUnfinished).not.toHaveBeenCalled();
    });

    it('бросает NotFoundException, если выпускаемого релиза нет', async () => {
      await expect(
        service.release(1, 'proj-1', 'x', { moveTo: 'none' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('удаляет релиз', async () => {
      await service.delete(1, 'proj-1', 'release-1');
      expect(releaseRepo.delete).toHaveBeenCalledWith('release-1', 'proj-1');
    });

    it('бросает NotFoundException, если релиза нет', async () => {
      releaseRepo.delete.mockResolvedValue(false);
      await expect(service.delete(1, 'proj-1', 'x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setGroupRelease', () => {
    beforeEach(() => {
      groupRepo.findById.mockResolvedValue(
        makeGroup({ type: 'story', releaseId: null }),
      );
      releaseRepo.findById.mockResolvedValue(makeRelease());
    });

    it('передаёт назначение и очистку в атомарный репозиторий', async () => {
      await service.setGroupRelease(1, 'proj-1', 'story-1', 'release-1');
      await service.setGroupRelease(1, 'proj-1', 'story-1', null);
      expect(releaseRepo.setGroupRelease.mock.calls).toEqual([
        ['proj-1', ['story-1'], 'release-1'],
        ['proj-1', ['story-1'], null],
      ]);
    });

    it('отвергает эпик и чужую историю', async () => {
      groupRepo.findById.mockResolvedValue(makeGroup());
      await expect(
        service.setGroupRelease(1, 'proj-1', 'epic', null),
      ).rejects.toThrow(BadRequestException);
      groupRepo.findById.mockResolvedValue(null);
      await expect(
        service.setGroupRelease(1, 'proj-1', 'foreign', null),
      ).rejects.toThrow(BadRequestException);
      expect(releaseRepo.setGroupRelease).not.toHaveBeenCalled();
    });

    it('отвергает назначение выпущенного релиза', async () => {
      releaseRepo.findById.mockResolvedValue(
        makeRelease({ status: 'released' }),
      );
      await expect(
        service.setGroupRelease(1, 'proj-1', 'story', 'release-1'),
      ).rejects.toThrow(BadRequestException);
      expect(releaseRepo.setGroupRelease).not.toHaveBeenCalled();
    });
  });

  describe('assignGroup', () => {
    beforeEach(() => {
      releaseRepo.findById.mockResolvedValue(makeRelease());
    });

    it('для эпика передаёт id эпика и всех его историй', async () => {
      groupRepo.findById.mockResolvedValue(makeGroup({ id: 'epic-1' }));
      groupRepo.findAllByProject.mockResolvedValue([
        makeGroup({ id: 'epic-1' }),
        makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1' }),
        makeGroup({ id: 'story-2', type: 'story', parentId: 'epic-1' }),
        makeGroup({ id: 'epic-2' }),
        makeGroup({ id: 'story-3', type: 'story', parentId: 'epic-2' }),
      ]);
      releaseRepo.assignGroupTasks.mockResolvedValue(4);

      const result = await service.assignGroup(1, 'proj-1', 'release-1', {
        groupId: 'epic-1',
      });

      expect(groupRepo.findById).toHaveBeenCalledWith('epic-1', 'proj-1');
      expect(releaseRepo.assignGroupTasks).toHaveBeenCalledWith('release-1', [
        'epic-1',
        'story-1',
        'story-2',
      ]);
      expect(result).toEqual({ updated: 4 });
    });

    it('для истории передаёт только её id', async () => {
      groupRepo.findById.mockResolvedValue(
        makeGroup({ id: 'story-1', type: 'story', parentId: 'epic-1' }),
      );
      releaseRepo.assignGroupTasks.mockResolvedValue(2);

      const result = await service.assignGroup(1, 'proj-1', 'release-1', {
        groupId: 'story-1',
      });

      expect(releaseRepo.assignGroupTasks).toHaveBeenCalledWith('release-1', [
        'story-1',
      ]);
      expect(groupRepo.findAllByProject).not.toHaveBeenCalled();
      expect(result).toEqual({ updated: 2 });
    });

    it('бросает 400, если группа чужого проекта или её нет', async () => {
      groupRepo.findById.mockResolvedValue(null);

      await expect(
        service.assignGroup(1, 'proj-1', 'release-1', { groupId: 'other' }),
      ).rejects.toThrow(BadRequestException);
      expect(releaseRepo.assignGroupTasks).not.toHaveBeenCalled();
    });

    it('бросает 400 для выпущенного релиза', async () => {
      releaseRepo.findById.mockResolvedValue(
        makeRelease({ status: 'released' }),
      );
      groupRepo.findById.mockResolvedValue(makeGroup());

      await expect(
        service.assignGroup(1, 'proj-1', 'release-1', { groupId: 'group-1' }),
      ).rejects.toThrow(BadRequestException);
      expect(releaseRepo.assignGroupTasks).not.toHaveBeenCalled();
    });

    it('бросает NotFoundException, если релиза нет', async () => {
      releaseRepo.findById.mockResolvedValue(null);

      await expect(
        service.assignGroup(1, 'proj-1', 'x', { groupId: 'group-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
