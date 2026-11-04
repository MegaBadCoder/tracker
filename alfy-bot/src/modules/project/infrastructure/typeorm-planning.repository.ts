import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Not } from 'typeorm';
import {
  BoardGroup,
  Sprint,
  SprintEvent,
  Task,
  User,
} from '../../../shared/entities';
import { PlanningRepositoryPort } from '../domain/planning-repository.port';
import {
  PlanningData,
  PlanningMove,
  PlanningOrder,
  planningSnapshot,
} from '../domain/planning';
import { planningProject } from './planning-access';
import {
  movePlanning,
  reorderPlanning,
  undoPlanning,
} from './planning-mutations';

@Injectable()
export class TypeOrmPlanningRepository extends PlanningRepositoryPort {
  constructor(private readonly source: DataSource) {
    super();
  }

  async load(userId: number, projectId: string): Promise<PlanningData> {
    return this.source.transaction(async (manager) => {
      const project = await planningProject(manager, userId, projectId);
      const user = await manager.findOneByOrFail(User, { id: userId });
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: user.timezone || 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      return {
        project,
        today,
        tasks: await manager.find(Task, {
          where: { projectId, userId },
          order: { order: 'ASC', id: 'ASC' },
        }),
        stories: await manager.find(BoardGroup, {
          where: { projectId, userId, type: 'story' },
          order: { order: 'ASC', id: 'ASC' },
        }),
        sprints: await manager.findBy(Sprint, { projectId, userId }),
        otherTasks: await manager.findBy(Task, {
          userId,
          projectId: Not(projectId),
        }),
        otherSprints: await manager.findBy(Sprint, {
          userId,
          projectId: Not(projectId),
        }),
      };
    });
  }

  async move(userId: number, projectId: string, input: PlanningMove) {
    return this.source.transaction(async (manager) => {
      await planningProject(manager, userId, projectId);
      return movePlanning(manager, userId, projectId, input);
    });
  }

  async undo(userId: number, projectId: string, token: string) {
    return this.source.transaction(async (manager) => {
      await planningProject(manager, userId, projectId);
      return undoPlanning(manager, userId, projectId, token);
    });
  }

  async reorder(userId: number, projectId: string, input: PlanningOrder) {
    return this.source.transaction(async (manager) => {
      await planningProject(manager, userId, projectId);
      return reorderPlanning(manager, projectId, input);
    });
  }

  async report(userId: number, projectId: string, sprintId: string) {
    return this.source.transaction(async (manager) => {
      await planningProject(manager, userId, projectId);
      const sprint = await manager.findOneBy(Sprint, {
        id: sprintId,
        projectId,
        userId,
      });
      if (!sprint) throw new NotFoundException('Спринт не найден');
      const tasks = await manager.findBy(Task, { sprintId });
      const stories = await manager.findBy(BoardGroup, {
        sprintId,
        type: 'story',
      });
      return {
        sprint,
        current: planningSnapshot(tasks, stories, new Date().toISOString()),
        events: await manager.find(SprintEvent, {
          where: { sprintId },
          order: { occurredAt: 'ASC', id: 'ASC' },
        }),
      };
    });
  }
}
