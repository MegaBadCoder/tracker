import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ProjectColumnService } from './project-column.service';
import { ProjectColumnRepositoryPort } from './domain/project-column-repository.port';
import { ProjectRepositoryPort } from './domain/project-repository.port';
import { Project, ProjectColumn } from '../../shared/entities';

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

describe('ProjectColumnService', () => {
  let service: ProjectColumnService;
  let colRepo: Record<string, jest.Mock>;
  let projRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    colRepo = {
      findAllByProject: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation((data) => Promise.resolve(makeColumn(data))),
      save: jest.fn().mockImplementation((col) => Promise.resolve(col)),
      delete: jest.fn().mockResolvedValue(true),
      reorder: jest.fn().mockResolvedValue(undefined),
    };

    projRepo = {
      findAllByUser: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      findByIdWithRelations: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      reorder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectColumnService,
        { provide: ProjectColumnRepositoryPort, useValue: colRepo },
        { provide: ProjectRepositoryPort, useValue: projRepo },
      ],
    }).compile();

    service = module.get(ProjectColumnService);
  });

  // ── getAllByProject ─────────────────────────────────────────────

  describe('getAllByProject', () => {
    it('возвращает колонки проекта отсортированные по order', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      const columns = [
        makeColumn({ order: 0 }),
        makeColumn({ id: 'col-2', order: 1 }),
      ];
      colRepo.findAllByProject.mockResolvedValue(columns);

      const result = await service.getAllByProject(1, 'proj-1');

      expect(colRepo.findAllByProject).toHaveBeenCalledWith('proj-1');
      expect(result).toHaveLength(2);
    });

    it('бросает NotFoundException если проект не найден', async () => {
      await expect(service.getAllByProject(1, 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── create ──────────────────────────────────────────────────────

  describe('create', () => {
    it('создаёт колонку с автоматическим order', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      colRepo.findAllByProject.mockResolvedValue([makeColumn({ order: 0 })]);

      const result = await service.create(1, 'proj-1', {
        title: 'In Progress',
      });

      expect(colRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          title: 'In Progress',
          order: 1,
        }),
      );
    });

    it('создаёт колонку с указанным color', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      colRepo.findAllByProject.mockResolvedValue([]);

      await service.create(1, 'proj-1', { title: 'Done', color: '#00ff00' });

      expect(colRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ color: '#00ff00' }),
      );
    });

    it('бросает NotFoundException если проект не найден', async () => {
      await expect(service.create(1, 'nope', { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('бросает ForbiddenException если проект принадлежит другому пользователю', async () => {
      projRepo.findById.mockResolvedValue(makeProject({ userId: 999 }));

      await expect(service.create(1, 'proj-1', { title: 'X' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('бросает BadRequestException если проект имеет viewMode=list', async () => {
      projRepo.findById.mockResolvedValue(makeProject({ viewMode: 'list' }));

      await expect(service.create(1, 'proj-1', { title: 'X' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── update ──────────────────────────────────────────────────────

  describe('update', () => {
    it('обновляет title колонки', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      colRepo.findById.mockResolvedValue(makeColumn());

      await service.update(1, 'proj-1', 'col-1', { title: 'Doing' });

      expect(colRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Doing' }),
      );
    });

    it('бросает NotFoundException если колонка не найдена', async () => {
      projRepo.findById.mockResolvedValue(makeProject());

      await expect(
        service.update(1, 'proj-1', 'nope', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('бросает ForbiddenException если проект принадлежит другому пользователю', async () => {
      projRepo.findById.mockResolvedValue(makeProject({ userId: 999 }));

      await expect(
        service.update(1, 'proj-1', 'col-1', { title: 'X' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── delete ──────────────────────────────────────────────────────

  describe('delete', () => {
    it('удаляет колонку', async () => {
      projRepo.findById.mockResolvedValue(makeProject());

      await service.delete(1, 'proj-1', 'col-1');

      expect(colRepo.delete).toHaveBeenCalledWith('col-1', 'proj-1');
    });

    it('бросает NotFoundException если колонка не найдена', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      colRepo.delete.mockResolvedValue(false);

      await expect(service.delete(1, 'proj-1', 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── reorder ─────────────────────────────────────────────────────

  describe('reorder', () => {
    it('обновляет порядок колонок по переданным ID', async () => {
      projRepo.findById.mockResolvedValue(makeProject());

      await service.reorder(1, 'proj-1', ['col-3', 'col-1', 'col-2']);

      expect(colRepo.reorder).toHaveBeenCalledWith([
        { id: 'col-3', order: 0 },
        { id: 'col-1', order: 1 },
        { id: 'col-2', order: 2 },
      ]);
    });

    it('бросает BadRequestException если массив пустой', async () => {
      projRepo.findById.mockResolvedValue(makeProject());

      await expect(service.reorder(1, 'proj-1', [])).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
