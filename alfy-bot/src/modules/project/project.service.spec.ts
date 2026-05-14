import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectRepositoryPort } from './domain/project-repository.port';
import { Project } from '../../shared/entities';

function makeProject(overrides: Partial<Project> = {}): Project {
  const p = new Project();
  Object.assign(p, {
    id: 'proj-1',
    userId: 1,
    parentId: null,
    title: 'Проект',
    description: null,
    viewMode: 'list' as const,
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

describe('ProjectService', () => {
  let service: ProjectService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      findAllByUser: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      findByIdWithRelations: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation((data) => Promise.resolve(makeProject(data))),
      save: jest.fn().mockImplementation((project) => Promise.resolve(project)),
      delete: jest.fn().mockResolvedValue(true),
      reorder: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: ProjectRepositoryPort, useValue: repo },
      ],
    }).compile();

    service = module.get(ProjectService);
  });

  // ── getAll ──────────────────────────────────────────────────────

  describe('getAll', () => {
    it('возвращает все проекты пользователя', async () => {
      const projects = [makeProject(), makeProject({ id: 'proj-2' })];
      repo.findAllByUser.mockResolvedValue(projects);

      const result = await service.getAll(1);

      expect(repo.findAllByUser).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(2);
    });

    it('возвращает пустой массив если проектов нет', async () => {
      const result = await service.getAll(1);
      expect(result).toEqual([]);
    });

    it('не включает проекты другого пользователя', async () => {
      repo.findAllByUser.mockResolvedValue([makeProject()]);

      const result = await service.getAll(1);

      expect(repo.findAllByUser).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(1);
    });
  });

  // ── getById ─────────────────────────────────────────────────────

  describe('getById', () => {
    it('возвращает проект с колонками', async () => {
      const project = makeProject();
      repo.findByIdWithRelations.mockResolvedValue(project);

      const result = await service.getById(1, 'proj-1');

      expect(repo.findByIdWithRelations).toHaveBeenCalledWith('proj-1', 1);
      expect(result).toEqual(project);
    });

    it('бросает NotFoundException если проект не найден', async () => {
      await expect(service.getById(1, 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('бросает NotFoundException если проект принадлежит другому пользователю', async () => {
      repo.findByIdWithRelations.mockResolvedValue(null);

      await expect(service.getById(1, 'proj-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── create ──────────────────────────────────────────────────────

  describe('create', () => {
    it('создаёт проект с viewMode по умолчанию list', async () => {
      const result = await service.create(1, { title: 'Новый проект' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          title: 'Новый проект',
          viewMode: 'list',
        }),
      );
      expect(result.title).toBe('Новый проект');
    });

    it('создаёт проект с viewMode board', async () => {
      const result = await service.create(1, {
        title: 'Доска',
        viewMode: 'board',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ viewMode: 'board' }),
      );
    });

    it('создаёт вложенный проект (parentId)', async () => {
      repo.findById.mockResolvedValue(makeProject());

      const result = await service.create(1, {
        title: 'Дочерний',
        parentId: 'proj-1',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: 'proj-1' }),
      );
    });

    it('создаёт проект с icon и color', async () => {
      const result = await service.create(1, {
        title: 'Яркий',
        icon: 'star',
        color: '#ff0000',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ icon: 'star', color: '#ff0000' }),
      );
    });

    it('создаёт проект без icon и color (остаются null)', async () => {
      const result = await service.create(1, { title: 'Простой' });

      const arg = repo.create.mock.calls[0][0];
      expect(arg.icon).toBeUndefined();
      expect(arg.color).toBeUndefined();
    });

    it('бросает NotFoundException если parentId не существует', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        service.create(1, { title: 'X', parentId: 'nope' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('бросает ForbiddenException если parentId указывает на проект другого пользователя', async () => {
      repo.findById.mockResolvedValue(makeProject({ userId: 999 }));

      await expect(
        service.create(1, { title: 'X', parentId: 'proj-1' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── update ──────────────────────────────────────────────────────

  describe('update', () => {
    it('обновляет title и viewMode', async () => {
      repo.findById.mockResolvedValue(makeProject());

      await service.update(1, 'proj-1', {
        title: 'Обновлённый',
        viewMode: 'board',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Обновлённый',
          viewMode: 'board',
        }),
      );
    });

    it('обновляет color проекта', async () => {
      repo.findById.mockResolvedValue(makeProject());

      await service.update(1, 'proj-1', { color: '#00ff00' });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ color: '#00ff00' }),
      );
    });

    it('обновляет icon проекта', async () => {
      repo.findById.mockResolvedValue(makeProject());

      await service.update(1, 'proj-1', { icon: 'rocket' });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ icon: 'rocket' }),
      );
    });

    it('сбрасывает color в null', async () => {
      repo.findById.mockResolvedValue(makeProject({ color: '#ff0000' }));

      await service.update(1, 'proj-1', { color: null });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ color: null }),
      );
    });

    it('сбрасывает icon в null', async () => {
      repo.findById.mockResolvedValue(makeProject({ icon: 'star' }));

      await service.update(1, 'proj-1', { icon: null });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ icon: null }),
      );
    });

    it('обновляет несколько полей одновременно (title + icon + color)', async () => {
      repo.findById.mockResolvedValue(makeProject());

      await service.update(1, 'proj-1', {
        title: 'Новый',
        icon: 'fire',
        color: '#0000ff',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Новый',
          icon: 'fire',
          color: '#0000ff',
        }),
      );
    });

    it('перемещает проект в другой родительский (обновление parentId)', async () => {
      repo.findById.mockImplementation((id: string) =>
        Promise.resolve(
          id === 'proj-1'
            ? makeProject()
            : id === 'proj-2'
              ? makeProject({ id: 'proj-2' })
              : null,
        ),
      );

      await service.update(1, 'proj-1', { parentId: 'proj-2' });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: 'proj-2' }),
      );
    });

    it('бросает NotFoundException если проект не найден', async () => {
      await expect(service.update(1, 'nope', { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('бросает BadRequestException при parentId = собственный id', async () => {
      repo.findById.mockResolvedValue(makeProject());

      await expect(
        service.update(1, 'proj-1', { parentId: 'proj-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('бросает NotFoundException если parentId указывает на несуществующий проект', async () => {
      repo.findById.mockImplementation((id: string) =>
        Promise.resolve(id === 'proj-1' ? makeProject() : null),
      );

      await expect(
        service.update(1, 'proj-1', { parentId: 'nope' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('бросает ForbiddenException если parentId указывает на проект другого пользователя', async () => {
      repo.findById.mockImplementation((id: string) =>
        Promise.resolve(
          id === 'proj-1'
            ? makeProject()
            : makeProject({ id: 'proj-2', userId: 999 }),
        ),
      );

      await expect(
        service.update(1, 'proj-1', { parentId: 'proj-2' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── delete ──────────────────────────────────────────────────────

  describe('delete', () => {
    it('удаляет проект', async () => {
      await service.delete(1, 'proj-1');
      expect(repo.delete).toHaveBeenCalledWith('proj-1', 1);
    });

    it('бросает NotFoundException если проект не найден', async () => {
      repo.delete.mockResolvedValue(false);

      await expect(service.delete(1, 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── reorder ─────────────────────────────────────────────────────

  describe('reorder', () => {
    it('обновляет порядок проектов по переданным ID', async () => {
      await service.reorder(1, ['proj-2', 'proj-1', 'proj-3']);

      expect(repo.reorder).toHaveBeenCalledWith([
        { id: 'proj-2', order: 0 },
        { id: 'proj-1', order: 1 },
        { id: 'proj-3', order: 2 },
      ]);
    });

    it('бросает BadRequestException если массив пустой', async () => {
      await expect(service.reorder(1, [])).rejects.toThrow(BadRequestException);
    });
  });
});
