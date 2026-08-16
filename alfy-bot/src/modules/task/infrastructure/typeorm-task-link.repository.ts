import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Goal, Link } from '../../../shared/entities';
import { LINK_KIND_GOAL, TaskLinkPort } from '../domain/task-link.port';

@Injectable()
export class TypeOrmTaskLinkRepository extends TaskLinkPort {
  constructor(
    @InjectRepository(Link)
    private readonly linkRepo: Repository<Link>,
    @InjectRepository(Goal)
    private readonly goalRepo: Repository<Goal>,
  ) {
    super();
  }

  async findGoalIdsByTaskIds(
    userId: number,
    taskIds: string[],
  ): Promise<Map<string, number[]>> {
    const map = new Map<string, number[]>();
    if (taskIds.length === 0) return map;

    const rows = await this.linkRepo.find({
      where: {
        userId,
        kind: LINK_KIND_GOAL,
        taskId: In(taskIds),
      },
    });

    for (const row of rows) {
      const list = map.get(row.taskId) ?? [];
      list.push(row.targetId);
      map.set(row.taskId, list);
    }
    return map;
  }

  async replaceGoalLinks(
    userId: number,
    taskId: string,
    goalIds: number[],
  ): Promise<void> {
    await this.linkRepo.manager.transaction(async (em) => {
      await em.delete(Link, { userId, taskId, kind: LINK_KIND_GOAL });
      if (goalIds.length === 0) return;
      await em.save(
        goalIds.map((targetId) =>
          em.create(Link, {
            userId,
            taskId,
            kind: LINK_KIND_GOAL,
            targetId,
          }),
        ),
      );
    });
  }

  async findTaskIdsByGoal(userId: number, goalId: number): Promise<string[]> {
    const rows = await this.linkRepo.find({
      where: { userId, kind: LINK_KIND_GOAL, targetId: goalId },
      select: ['taskId'],
    });
    return rows.map((r) => r.taskId);
  }

  async replaceTaskLinksForGoal(
    userId: number,
    goalId: number,
    taskIds: string[],
  ): Promise<void> {
    await this.linkRepo.manager.transaction(async (em) => {
      await em.delete(Link, {
        userId,
        kind: LINK_KIND_GOAL,
        targetId: goalId,
      });
      if (taskIds.length === 0) return;
      await em.save(
        taskIds.map((taskId) =>
          em.create(Link, {
            userId,
            taskId,
            kind: LINK_KIND_GOAL,
            targetId: goalId,
          }),
        ),
      );
    });
  }

  async filterOwnedGoalIds(
    userId: number,
    goalIds: number[],
  ): Promise<number[]> {
    if (goalIds.length === 0) return [];
    const unique = [...new Set(goalIds)];
    const rows = await this.goalRepo.find({
      where: { user_id: userId, id: In(unique), status: Not('deleted') },
      select: ['id'],
    });
    return rows.map((r) => r.id);
  }

  async copyGoalLinks(
    userId: number,
    fromTaskId: string,
    toTaskId: string,
  ): Promise<void> {
    const rows = await this.linkRepo.find({
      where: { userId, taskId: fromTaskId, kind: LINK_KIND_GOAL },
    });
    if (rows.length === 0) return;
    await this.linkRepo.save(
      rows.map((row) =>
        this.linkRepo.create({
          userId,
          taskId: toTaskId,
          kind: LINK_KIND_GOAL,
          targetId: row.targetId,
        }),
      ),
    );
  }
}
