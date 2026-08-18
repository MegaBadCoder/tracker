import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Goal, Question } from '../../shared/entities';
import { JwtOrApiTokenGuard } from '../auth/guards/jwt-or-api-token.guard';
import { GoalService } from './application/goal.service';
import { AddQuestionsDto } from './dto/add-questions.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GoalController } from './goal.controller';
import { TaskGoalQueryPort } from '../task/domain/task-goal-query.port';

type AuthRequestLike = { user: { sub: number } };

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  const g = new Goal();
  Object.assign(g, {
    id: 1,
    goal_name: 'Тестовая цель',
    goal_start: '2026-02-01',
    goal_end: '2026-05-01',
    status: 'active',
    user_id: 42,
    createdAt: new Date('2026-02-01T10:00:00.000Z'),
    questions: [] as Question[],
    ...overrides,
  });
  return g;
}

describe('GoalController', () => {
  let controller: GoalController;
  let goalService: {
    create: jest.Mock;
    findById: jest.Mock;
    findByUser: jest.Mock;
    findActiveByUser: jest.Mock;
    findByStatus: jest.Mock;
    findAllByUser: jest.Mock;
    findChildren: jest.Mock;
    assertValidParent: jest.Mock;
    addQuestionsWithSchedules: jest.Mock;
    addQuestions: jest.Mock;
    update: jest.Mock;
    updateGoalStatus: jest.Mock;
    findQuestionById: jest.Mock;
    updateQuestionSchedule: jest.Mock;
  };

  beforeEach(async () => {
    goalService = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUser: jest.fn(),
      findActiveByUser: jest.fn(),
      findByStatus: jest.fn(),
      findAllByUser: jest.fn(),
      findChildren: jest.fn(),
      assertValidParent: jest.fn(),
      addQuestionsWithSchedules: jest.fn(),
      addQuestions: jest.fn(),
      update: jest.fn(),
      updateGoalStatus: jest.fn(),
      findQuestionById: jest.fn(),
      updateQuestionSchedule: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoalController],
      providers: [
        { provide: GoalService, useValue: goalService },
        {
          provide: TaskGoalQueryPort,
          useValue: {
            listByGoal: jest.fn(),
            replaceTaskLinksForGoal: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtOrApiTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(GoalController);
  });

  describe('POST /goals (create)', () => {
    it('форвардит в goalService.create с userId из JWT', async () => {
      const userId = 42;
      const dto: CreateGoalDto = {
        goal_name: 'Читать',
        goal_start: '2026-02-01',
        goal_end: '2026-05-01',
      };
      const created = makeGoal({ user_id: userId, ...dto });
      goalService.create.mockResolvedValue(created);

      const req = { user: { sub: userId } } as AuthRequestLike;
      const result = await controller.create(req as never, dto);

      expect(goalService.create).toHaveBeenCalledWith(userId, dto);
      expect(result).toEqual({ ...created, questions: [] });
    });

    it('бросает BadRequestException, если goal_end <= goal_start', async () => {
      const dto: CreateGoalDto = {
        goal_name: 'X',
        goal_start: '2026-05-01',
        goal_end: '2026-05-01',
      };
      const req = { user: { sub: 42 } } as AuthRequestLike;

      await expect(controller.create(req as never, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(goalService.create).not.toHaveBeenCalled();
    });

    it('бросает BadRequestException на семантически невалидной дате (regex прошёл, Date.parse → NaN)', async () => {
      const dto: CreateGoalDto = {
        goal_name: 'X',
        goal_start: '2026-02-01',
        goal_end: '2026-13-01',
      };
      const req = { user: { sub: 42 } } as AuthRequestLike;

      await expect(controller.create(req as never, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(goalService.create).not.toHaveBeenCalled();
    });

    it('создаёт global-цель без дат (даты не валидируются)', async () => {
      const userId = 42;
      const dto: CreateGoalDto = {
        goal_name: 'Финансы',
        is_global: true,
      };
      const created = makeGoal({
        id: 5,
        user_id: userId,
        goal_name: 'Финансы',
        is_global: true,
        goal_start: null,
        goal_end: null,
      });
      goalService.create.mockResolvedValue(created);

      const req = { user: { sub: userId } } as AuthRequestLike;
      const result = await controller.create(req as never, dto);

      expect(goalService.create).toHaveBeenCalledWith(userId, dto);
      expect(result).toEqual({ ...created, questions: [] });
    });

    it('DTO-валидация: обычная цель без дат не проходит @ValidateIf', async () => {
      const dto = plainToInstance(CreateGoalDto, { goal_name: 'X' });
      const errors = await validate(dto);
      const props = errors.map((e) => e.property);

      expect(props).toContain('goal_start');
      expect(props).toContain('goal_end');
    });

    it('DTO-валидация: global-цель без дат проходит', async () => {
      const dto = plainToInstance(CreateGoalDto, {
        goal_name: 'Финансы',
        is_global: true,
      });
      const errors = await validate(dto);
      const props = errors.map((e) => e.property);

      expect(props).not.toContain('goal_start');
      expect(props).not.toContain('goal_end');
    });

    it('DTO-валидация: is_global и parent_goal_id объявлены (whitelist не вырежет)', async () => {
      const dto = plainToInstance(CreateGoalDto, {
        goal_name: 'Подцель',
        goal_start: '2026-02-01',
        goal_end: '2026-05-01',
        parent_goal_id: 3,
        is_global: false,
      });
      const errors = await validate(dto, { whitelist: true });

      expect(errors).toHaveLength(0);
      expect(dto.parent_goal_id).toBe(3);
      expect(dto.is_global).toBe(false);
    });

    it('бросает BadRequestException, если parent не global (assertValidParent throw)', async () => {
      const dto: CreateGoalDto = {
        goal_name: 'Подцель',
        goal_start: '2026-02-01',
        goal_end: '2026-05-01',
        parent_goal_id: 9,
      };
      goalService.assertValidParent.mockRejectedValue(
        new BadRequestException('not a global goal'),
      );
      const req = { user: { sub: 42 } } as AuthRequestLike;

      await expect(controller.create(req as never, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(goalService.assertValidParent).toHaveBeenCalledWith(42, 9);
      expect(goalService.create).not.toHaveBeenCalled();
    });

    it('валидный parent → вызывает assertValidParent и create', async () => {
      const userId = 42;
      const dto: CreateGoalDto = {
        goal_name: 'Подцель',
        goal_start: '2026-02-01',
        goal_end: '2026-05-01',
        parent_goal_id: 9,
      };
      goalService.assertValidParent.mockResolvedValue(undefined);
      const created = makeGoal({ id: 11, user_id: userId, parent_goal_id: 9 });
      goalService.create.mockResolvedValue(created);

      const req = { user: { sub: userId } } as AuthRequestLike;
      const result = await controller.create(req as never, dto);

      expect(goalService.assertValidParent).toHaveBeenCalledWith(userId, 9);
      expect(goalService.create).toHaveBeenCalledWith(userId, dto);
      expect(result).toEqual({ ...created, questions: [] });
    });

    it('бросает BadRequestException для global-цели с parent_goal_id', async () => {
      const dto: CreateGoalDto = {
        goal_name: 'Финансы',
        is_global: true,
        parent_goal_id: 9,
      };
      const req = { user: { sub: 42 } } as AuthRequestLike;

      await expect(controller.create(req as never, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(goalService.assertValidParent).not.toHaveBeenCalled();
      expect(goalService.create).not.toHaveBeenCalled();
    });
  });

  describe('POST /goals/:id/questions (addQuestions)', () => {
    it('форвардит в addQuestionsWithSchedules после assertOwnedGoal', async () => {
      const userId = 42;
      const goalId = 7;
      goalService.findById.mockResolvedValue(
        makeGoal({ id: goalId, user_id: userId }),
      );
      const savedQuestions: Question[] = [
        Object.assign(new Question(), { id: 100 }),
      ];
      goalService.addQuestionsWithSchedules.mockResolvedValue(savedQuestions);

      const dto: AddQuestionsDto = {
        questions: [
          {
            question: 'Сколько страниц прочитал?',
            type: 'number',
            canSkip: false,
            scheduleType: 'daily',
            targetValue: '30',
          },
        ],
      };

      const req = { user: { sub: userId } } as AuthRequestLike;
      const result = await controller.addQuestions(req as never, goalId, dto);

      expect(goalService.findById).toHaveBeenCalledWith(goalId);
      expect(goalService.addQuestionsWithSchedules).toHaveBeenCalledWith(
        goalId,
        dto.questions,
      );
      expect(result).toBe(savedQuestions);
    });

    it('бросает BadRequestException при добавлении вопросов к global-цели', async () => {
      const userId = 42;
      const goalId = 7;
      goalService.findById.mockResolvedValue(
        makeGoal({ id: goalId, user_id: userId, is_global: true }),
      );

      const dto: AddQuestionsDto = {
        questions: [
          {
            question: 'Q',
            type: 'number',
            canSkip: false,
            scheduleType: 'daily',
          },
        ],
      };
      const req = { user: { sub: userId } } as AuthRequestLike;

      await expect(
        controller.addQuestions(req as never, goalId, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(goalService.addQuestionsWithSchedules).not.toHaveBeenCalled();
    });
  });

  describe('GET /goals (findAll) scope', () => {
    it('пробрасывает scope в findAllByUser', async () => {
      goalService.findAllByUser.mockResolvedValue([]);
      const req = { user: { sub: 42 } } as AuthRequestLike;

      await controller.findAll(req as never, undefined, 'global');

      expect(goalService.findAllByUser).toHaveBeenCalledWith(42, 'global');
    });

    it('пробрасывает scope в findByStatus при наличии status', async () => {
      goalService.findByStatus.mockResolvedValue([]);
      const req = { user: { sub: 42 } } as AuthRequestLike;

      await controller.findAll(req as never, 'active', 'regular');

      expect(goalService.findByStatus).toHaveBeenCalledWith(
        42,
        'active',
        'regular',
      );
    });
  });

  describe('GET /goals/:id (findOne) children embed', () => {
    it('для global-цели догружает детей через findChildren', async () => {
      const userId = 42;
      const goalId = 3;
      const goal = makeGoal({ id: goalId, user_id: userId, is_global: true });
      goalService.findById.mockResolvedValue(goal);
      const children = [
        makeGoal({ id: 4, user_id: userId, parent_goal_id: 3 }),
      ];
      goalService.findChildren.mockResolvedValue(children);

      const req = { user: { sub: userId } } as AuthRequestLike;
      const result = await controller.findOne(req as never, goalId);

      expect(goalService.findChildren).toHaveBeenCalledWith(goalId);
      expect((result as Goal).children).toBe(children);
    });

    it('для обычной цели не вызывает findChildren', async () => {
      const userId = 42;
      const goalId = 3;
      goalService.findById.mockResolvedValue(
        makeGoal({ id: goalId, user_id: userId, is_global: false }),
      );

      const req = { user: { sub: userId } } as AuthRequestLike;
      await controller.findOne(req as never, goalId);

      expect(goalService.findChildren).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /goals/:id (update)', () => {
    it('status update вызывает updateGoalStatus и возвращает свежее состояние', async () => {
      const userId = 42;
      const goalId = 7;
      const owned = makeGoal({ id: goalId, user_id: userId, status: 'active' });
      const updated = makeGoal({
        id: goalId,
        user_id: userId,
        status: 'completed',
      });
      goalService.findById
        .mockResolvedValueOnce(owned)
        .mockResolvedValueOnce(updated);
      goalService.updateGoalStatus.mockResolvedValue(undefined);

      const dto: UpdateGoalDto = { status: 'completed' };
      const req = { user: { sub: userId } } as AuthRequestLike;

      const result = await controller.update(req as never, goalId, dto);

      expect(goalService.updateGoalStatus).toHaveBeenCalledWith(
        goalId,
        'completed',
      );
      expect(goalService.update).not.toHaveBeenCalled();
      expect(result).toBe(updated);
    });

    it('форвардит status="archived" в updateGoalStatus', async () => {
      const userId = 42;
      const goalId = 7;
      const owned = makeGoal({ id: goalId, user_id: userId, status: 'active' });
      const updated = makeGoal({
        id: goalId,
        user_id: userId,
        status: 'archived',
      });
      goalService.findById
        .mockResolvedValueOnce(owned)
        .mockResolvedValueOnce(updated);
      goalService.updateGoalStatus.mockResolvedValue(undefined);

      const dto: UpdateGoalDto = { status: 'archived' };
      const req = { user: { sub: userId } } as AuthRequestLike;

      const result = await controller.update(req as never, goalId, dto);

      expect(goalService.updateGoalStatus).toHaveBeenCalledWith(
        goalId,
        'archived',
      );
      expect(result).toBe(updated);
    });

    it('status=completed + outcome=failure пишет оба поля', async () => {
      const userId = 42;
      const goalId = 7;
      const owned = makeGoal({ id: goalId, user_id: userId, status: 'active' });
      const updated = makeGoal({
        id: goalId,
        user_id: userId,
        status: 'completed',
        outcome: 'failure',
      });
      goalService.findById
        .mockResolvedValueOnce(owned)
        .mockResolvedValueOnce(updated);
      goalService.updateGoalStatus.mockResolvedValue(undefined);
      goalService.update.mockResolvedValue(updated);

      const dto: UpdateGoalDto = { status: 'completed', outcome: 'failure' };
      const req = { user: { sub: userId } } as AuthRequestLike;

      const result = await controller.update(req as never, goalId, dto);

      expect(goalService.updateGoalStatus).toHaveBeenCalledWith(
        goalId,
        'completed',
      );
      expect(goalService.update).toHaveBeenCalledWith(goalId, {
        outcome: 'failure',
      });
      expect(result).toBe(updated);
    });

    it('валидный parent_goal_id → assertValidParent + update', async () => {
      const userId = 42;
      const goalId = 7;
      const owned = makeGoal({ id: goalId, user_id: userId, is_global: false });
      const updated = makeGoal({
        id: goalId,
        user_id: userId,
        parent_goal_id: 9,
      });
      goalService.findById
        .mockResolvedValueOnce(owned)
        .mockResolvedValueOnce(updated);
      goalService.assertValidParent.mockResolvedValue(undefined);
      goalService.update.mockResolvedValue(updated);

      const dto: UpdateGoalDto = { parent_goal_id: 9 };
      const req = { user: { sub: userId } } as AuthRequestLike;

      const result = await controller.update(req as never, goalId, dto);

      expect(goalService.assertValidParent).toHaveBeenCalledWith(userId, 9);
      expect(goalService.update).toHaveBeenCalledWith(goalId, {
        parent_goal_id: 9,
      });
      expect(result).toBe(updated);
    });

    it('parent_goal_id у global-цели → BadRequestException', async () => {
      const userId = 42;
      const goalId = 7;
      goalService.findById.mockResolvedValue(
        makeGoal({ id: goalId, user_id: userId, is_global: true }),
      );
      goalService.assertValidParent.mockResolvedValue(undefined);

      const dto: UpdateGoalDto = { parent_goal_id: 9 };
      const req = { user: { sub: userId } } as AuthRequestLike;

      await expect(
        controller.update(req as never, goalId, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(goalService.update).not.toHaveBeenCalled();
    });

    it('невалидный parent_goal_id → BadRequestException (assertValidParent throw)', async () => {
      const userId = 42;
      const goalId = 7;
      goalService.findById.mockResolvedValue(
        makeGoal({ id: goalId, user_id: userId, is_global: false }),
      );
      goalService.assertValidParent.mockRejectedValue(
        new BadRequestException('not a global goal'),
      );

      const dto: UpdateGoalDto = { parent_goal_id: 9 };
      const req = { user: { sub: userId } } as AuthRequestLike;

      await expect(
        controller.update(req as never, goalId, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(goalService.update).not.toHaveBeenCalled();
    });

    it('DTO-валидация: UpdateGoalDto принимает parent_goal_id null и int, отклоняет строку', async () => {
      const okNull = await validate(
        plainToInstance(UpdateGoalDto, { parent_goal_id: null }),
      );
      expect(okNull).toHaveLength(0);

      const okInt = await validate(
        plainToInstance(UpdateGoalDto, { parent_goal_id: 5 }),
      );
      expect(okInt).toHaveLength(0);

      const badStr = await validate(
        plainToInstance(UpdateGoalDto, { parent_goal_id: 'x' }),
      );
      expect(badStr.map((e) => e.property)).toContain('parent_goal_id');
    });

    it('parent_goal_id === null → отвязывает (update с null)', async () => {
      const userId = 42;
      const goalId = 7;
      const owned = makeGoal({ id: goalId, user_id: userId, is_global: false });
      const updated = makeGoal({
        id: goalId,
        user_id: userId,
        parent_goal_id: null,
      });
      goalService.findById
        .mockResolvedValueOnce(owned)
        .mockResolvedValueOnce(updated);
      goalService.update.mockResolvedValue(updated);

      const dto: UpdateGoalDto = { parent_goal_id: null };
      const req = { user: { sub: userId } } as AuthRequestLike;

      const result = await controller.update(req as never, goalId, dto);

      expect(goalService.assertValidParent).not.toHaveBeenCalled();
      expect(goalService.update).toHaveBeenCalledWith(goalId, {
        parent_goal_id: null,
      });
      expect(result).toBe(updated);
    });
  });

  describe('assertOwnedGoal (negative)', () => {
    it('бросает NotFoundException, если goal принадлежит другому пользователю', async () => {
      const goalId = 7;
      goalService.findById.mockResolvedValue(
        makeGoal({ id: goalId, user_id: 999 }),
      );

      const req = { user: { sub: 42 } } as AuthRequestLike;
      const dto: UpdateGoalDto = { status: 'completed' };

      await expect(
        controller.update(req as never, goalId, dto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(goalService.updateGoalStatus).not.toHaveBeenCalled();
    });
  });
});
