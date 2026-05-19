import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Goal, Question } from '../../shared/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GoalService } from './application/goal.service';
import { AddQuestionsDto } from './dto/add-questions.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GoalController } from './goal.controller';

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
      addQuestionsWithSchedules: jest.fn(),
      addQuestions: jest.fn(),
      update: jest.fn(),
      updateGoalStatus: jest.fn(),
      findQuestionById: jest.fn(),
      updateQuestionSchedule: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoalController],
      providers: [{ provide: GoalService, useValue: goalService }],
    })
      .overrideGuard(JwtAuthGuard)
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
  });

  describe('POST /goals/:id/questions (addQuestions)', () => {
    it('форвардит в addQuestionsWithSchedules после assertOwnedGoal', async () => {
      const userId = 42;
      const goalId = 7;
      goalService.findById.mockResolvedValue(makeGoal({ id: goalId, user_id: userId }));
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
  });

  describe('PATCH /goals/:id (update)', () => {
    it('status update вызывает updateGoalStatus и возвращает свежее состояние', async () => {
      const userId = 42;
      const goalId = 7;
      const owned = makeGoal({ id: goalId, user_id: userId, status: 'active' });
      const updated = makeGoal({ id: goalId, user_id: userId, status: 'completed' });
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
