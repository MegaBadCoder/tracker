import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Goal, Question } from '../../../shared/entities';
import {
  GoalRepositoryPort,
  QuestionData,
} from '../domain/goal-repository.port';

@Injectable()
export class TypeOrmGoalRepository extends GoalRepositoryPort {
  constructor(
    @InjectRepository(Goal)
    private goalRepo: Repository<Goal>,
    @InjectRepository(Question)
    private questionRepo: Repository<Question>,
  ) {
    super();
  }

  async create(
    userId: number,
    goalData:
      | Partial<Goal>
      | {
          goal_name: string;
          goal_start?: string;
          goal_end?: string;
          is_global?: boolean;
          parent_goal_id?: number | null;
          questions?: QuestionData[];
        },
  ): Promise<Goal> {
    if ('questions' in goalData && Array.isArray(goalData.questions)) {
      const { questions, ...goalInfo } = goalData as {
        goal_name: string;
        goal_start?: string;
        goal_end?: string;
        is_global?: boolean;
        parent_goal_id?: number | null;
        questions: QuestionData[];
      };
      const goal = this.goalRepo.create({
        ...goalInfo,
        user_id: userId,
        status: 'active',
      });
      const savedGoal = await this.goalRepo.save(goal);

      const questionEntities = questions.map((q, index) =>
        this.questionRepo.create({
          goal_id: savedGoal.id,
          question: q.question,
          type: q.type,
          can_skip: q.canSkip,
          order_index: index,
          is_active: true,
        }),
      );
      await this.questionRepo.save(questionEntities);
      return savedGoal;
    }

    const goal = this.goalRepo.create({
      ...goalData,
      user_id: userId,
      status: 'active',
    });
    return this.goalRepo.save(goal);
  }

  async findByUser(userId: number): Promise<Goal[]> {
    return this.goalRepo.find({
      where: { user_id: userId },
      relations: ['questions'],
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveByUser(userId: number): Promise<Goal[]> {
    return this.goalRepo.find({
      where: { user_id: userId, status: 'active' },
      relations: ['questions'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAllByUser(
    userId: number,
    scope: 'global' | 'regular' | 'all' = 'all',
  ): Promise<Goal[]> {
    return this.goalRepo.find({
      where: {
        user_id: userId,
        status: Not('deleted'),
        ...(scope === 'all' ? {} : { is_global: scope === 'global' }),
      },
      relations: ['questions'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(
    userId: number,
    status: string,
    scope: 'global' | 'regular' | 'all' = 'all',
  ): Promise<Goal[]> {
    return this.goalRepo.find({
      where: {
        user_id: userId,
        status,
        ...(scope === 'all' ? {} : { is_global: scope === 'global' }),
      },
      relations: ['questions'],
      order: { createdAt: 'DESC' },
    });
  }

  async findChildren(parentGoalId: number): Promise<Goal[]> {
    return this.goalRepo.find({
      where: { parent_goal_id: parentGoalId, status: Not('deleted') },
      relations: ['questions'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(goalId: number): Promise<Goal | null> {
    return this.goalRepo.findOne({
      where: { id: goalId },
      relations: ['questions', 'children'],
      order: { questions: { order_index: 'ASC' } },
    });
  }

  async update(goalId: number, updates: Partial<Goal>): Promise<Goal> {
    await this.goalRepo.update(goalId, updates);
    const goal = await this.findById(goalId);
    if (!goal) throw new Error(`Goal with id ${goalId} not found`);
    return goal;
  }

  async updateGoalStatus(goalId: number, status: string): Promise<void> {
    await this.goalRepo.update(goalId, { status });
  }

  async addQuestions(
    goalId: number,
    questions: Array<{
      question: string;
      type: string;
      canSkip: boolean;
      targetValue?: string;
    }>,
  ): Promise<Question[]> {
    const maxOrder = await this.questionRepo
      .createQueryBuilder('q')
      .select('MAX(q.order_index)', 'max')
      .where('q.goal_id = :goalId', { goalId })
      .getRawOne();

    const startIndex = ((maxOrder?.max as number) ?? -1) + 1;

    const entities = questions.map((q, index) =>
      this.questionRepo.create({
        goal_id: goalId,
        question: q.question,
        type: q.type,
        can_skip: q.canSkip,
        target_value: q.targetValue ?? null,
        order_index: startIndex + index,
        is_active: true,
      }),
    );

    return this.questionRepo.save(entities);
  }

  async findQuestionById(questionId: number): Promise<Question | null> {
    return this.questionRepo.findOne({
      where: { id: questionId },
      relations: ['goal'],
    });
  }
}
