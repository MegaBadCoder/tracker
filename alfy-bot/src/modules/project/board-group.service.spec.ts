import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { BoardGroupService } from './board-group.service';
import { BoardGroupRepositoryPort } from './domain/board-group-repository.port';
import { ProjectRepositoryPort } from './domain/project-repository.port';
import { BoardGroup, Project } from '../../shared/entities';

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

function makeGroup(overrides: Partial<BoardGroup> = {}): BoardGroup {
  const g = new BoardGroup();
  Object.assign(g, {
    id: 'group-1',
    userId: 1,
    projectId: 'proj-1',
    parentId: null,
    type: 'epic' as const,
    title: 'Эпик',
    description: null,
    status: 'open' as const,
    completedAt: null,
    color: null,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return g;
}

describe('BoardGroupService', () => {
  let service: BoardGroupService;
  let groupRepo: Record<string, jest.Mock>;
  let projRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    groupRepo = {
      findAllByProject: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      countChildren: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockImplementation((data) => Promise.resolve(makeGroup(data))),
      save: jest.fn().mockImplementation((group) => Promise.resolve(group)),
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
        BoardGroupService,
        { provide: BoardGroupRepositoryPort, useValue: groupRepo },
        { provide: ProjectRepositoryPort, useValue: projRepo },
      ],
    }).compile();

    service = module.get(BoardGroupService);
  });

  // ── getTree ─────────────────────────────────────────────────────

  describe('getTree', () => {
    it('собирает плоский список в дерево: эпики верхнего уровня с вложенными историями, в порядке order', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      const epicA = makeGroup({ id: 'epic-a', order: 0 });
      const epicB = makeGroup({ id: 'epic-b', order: 1 });
      const storyA1 = makeGroup({
        id: 'story-a1',
        type: 'story',
        parentId: 'epic-a',
        order: 0,
      });
      const storyA2 = makeGroup({
        id: 'story-a2',
        type: 'story',
        parentId: 'epic-a',
        order: 1,
      });
      groupRepo.findAllByProject.mockResolvedValue([
        epicA,
        epicB,
        storyA1,
        storyA2,
      ]);

      const tree = await service.getTree(1, 'proj-1');

      expect(tree).toHaveLength(2);
      expect(tree[0].id).toBe('epic-a');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].id).toBe('story-a1');
      expect(tree[0].children[1].id).toBe('story-a2');
      expect(tree[1].id).toBe('epic-b');
      expect(tree[1].children).toHaveLength(0);
    });

    it('бросает NotFoundException если проект не найден', async () => {
      await expect(service.getTree(1, 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── create ──────────────────────────────────────────────────────

  describe('create', () => {
    it('создаёт эпик без parentId', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      groupRepo.findAllByProject.mockResolvedValue([makeGroup({ order: 0 })]);

      await service.create(1, 'proj-1', { title: 'Новый эпик' });

      expect(groupRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          parentId: null,
          type: 'epic',
          title: 'Новый эпик',
          order: 1,
        }),
      );
    });

    it('создаёт историю с parentId у существующего эпика', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      const epic = makeGroup({ id: 'epic-1', parentId: null });
      groupRepo.findById.mockResolvedValue(epic);
      groupRepo.findAllByProject.mockResolvedValue([]);

      await service.create(1, 'proj-1', {
        title: 'Новая история',
        parentId: 'epic-1',
      });

      expect(groupRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'epic-1',
          type: 'story',
          title: 'Новая история',
          order: 0,
        }),
      );
    });

    it('бросает BadRequestException если родитель не найден', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      groupRepo.findById.mockResolvedValue(null);

      await expect(
        service.create(1, 'proj-1', { title: 'X', parentId: 'nope' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('бросает BadRequestException при попытке вложить группу в историю (parent.parentId !== null)', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      const story = makeGroup({
        id: 'story-1',
        type: 'story',
        parentId: 'epic-1',
      });
      groupRepo.findById.mockResolvedValue(story);

      await expect(
        service.create(1, 'proj-1', { title: 'X', parentId: 'story-1' }),
      ).rejects.toThrow(BadRequestException);
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
  });

  // ── update ──────────────────────────────────────────────────────

  describe('update', () => {
    // CHK_board_group_not_self поймает это и в БД, но сырая ошибка SQLite
    // дойдёт до клиента как 500. Сервис обязан отдать 400 — как это уже
    // сделано для проектов в project.service.ts.
    it('отдаёт 400 при попытке сделать группу родителем самой себе', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      groupRepo.findById.mockResolvedValue(makeGroup({ id: 'group-1' }));
      groupRepo.countChildren.mockResolvedValue(0);

      await expect(
        service.update(1, 'proj-1', 'group-1', { parentId: 'group-1' }),
      ).rejects.toThrow(BadRequestException);

      expect(groupRepo.save).not.toHaveBeenCalled();
    });

    it('обновляет title группы', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      groupRepo.findById.mockResolvedValue(makeGroup());

      await service.update(1, 'proj-1', 'group-1', {
        title: 'Новый заголовок',
      });

      expect(groupRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Новый заголовок' }),
      );
    });

    it('status: done ставит completedAt', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      groupRepo.findById.mockResolvedValue(
        makeGroup({ status: 'open', completedAt: null }),
      );

      await service.update(1, 'proj-1', 'group-1', { status: 'done' });

      expect(groupRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'done',
          completedAt: expect.any(Date),
        }),
      );
    });

    it('status: open обнуляет completedAt', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      groupRepo.findById.mockResolvedValue(
        makeGroup({ status: 'done', completedAt: new Date() }),
      );

      await service.update(1, 'proj-1', 'group-1', { status: 'open' });

      expect(groupRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'open', completedAt: null }),
      );
    });

    it('бросает BadRequestException при смене parentId, если у группы есть дети', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      groupRepo.findById.mockResolvedValue(
        makeGroup({ id: 'epic-1', parentId: null }),
      );
      groupRepo.countChildren.mockResolvedValue(2);

      await expect(
        service.update(1, 'proj-1', 'epic-1', { parentId: 'epic-2' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('разрешает смену parentId, если у группы нет детей и новый родитель — эпик верхнего уровня', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      const target = makeGroup({ id: 'epic-1', parentId: null });
      groupRepo.findById
        .mockResolvedValueOnce(target)
        .mockResolvedValueOnce(makeGroup({ id: 'epic-2', parentId: null }));
      groupRepo.countChildren.mockResolvedValue(0);

      await service.update(1, 'proj-1', 'epic-1', { parentId: 'epic-2' });

      expect(groupRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: 'epic-2', type: 'story' }),
      );
    });

    it('бросает NotFoundException если группа не найдена', async () => {
      projRepo.findById.mockResolvedValue(makeProject());

      await expect(
        service.update(1, 'proj-1', 'nope', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('бросает ForbiddenException если проект принадлежит другому пользователю', async () => {
      projRepo.findById.mockResolvedValue(makeProject({ userId: 999 }));

      await expect(
        service.update(1, 'proj-1', 'group-1', { title: 'X' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── delete ──────────────────────────────────────────────────────

  describe('delete', () => {
    it('удаляет группу (каскад историй/обнуление groupId у задач обеспечен FK)', async () => {
      projRepo.findById.mockResolvedValue(makeProject());

      await service.delete(1, 'proj-1', 'epic-1');

      expect(groupRepo.delete).toHaveBeenCalledWith('epic-1', 'proj-1');
    });

    it('бросает NotFoundException если группа не найдена', async () => {
      projRepo.findById.mockResolvedValue(makeProject());
      groupRepo.delete.mockResolvedValue(false);

      await expect(service.delete(1, 'proj-1', 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── reorder ─────────────────────────────────────────────────────

  describe('reorder', () => {
    it('обновляет порядок групп по переданным ID', async () => {
      projRepo.findById.mockResolvedValue(makeProject());

      await service.reorder(1, 'proj-1', ['group-3', 'group-1', 'group-2']);

      expect(groupRepo.reorder).toHaveBeenCalledWith([
        { id: 'group-3', order: 0 },
        { id: 'group-1', order: 1 },
        { id: 'group-2', order: 2 },
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
