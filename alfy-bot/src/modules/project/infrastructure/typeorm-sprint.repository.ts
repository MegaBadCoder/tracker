import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  BoardGroup,
  Project,
  ProjectColumn,
  Sprint,
  Task,
} from '../../../shared/entities';
import { planningSnapshot, type SprintCompletion } from '../domain/planning';
import { storyWorkflow, normalizeStoryGroup } from '../domain/story-workflow';
import { mutableSprint } from './planning-access';
import { completeSprintInTransaction } from './sprint-completion';
import { SprintRepositoryPort } from '../domain/sprint-repository.port';

@Injectable()
export class TypeOrmSprintRepository extends SprintRepositoryPort {
  constructor(
    @InjectRepository(Sprint)
    private repo: Repository<Sprint>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {
    super();
  }

  async findAllByProject(projectId: string): Promise<Sprint[]> {
    return this.repo.find({
      where: { projectId },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  async findById(id: string, projectId: string): Promise<Sprint | null> {
    return this.repo.findOne({ where: { id, projectId } });
  }

  async findActive(projectId: string): Promise<Sprint | null> {
    return this.repo.findOne({ where: { projectId, status: 'active' } });
  }

  async create(data: Partial<Sprint>): Promise<Sprint> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async save(sprint: Sprint): Promise<Sprint> {
    return this.dataSource.transaction(async (manager) => {
      const current = await manager.findOneByOrFail(Sprint, { id: sprint.id });
      if (
        current.status === 'closed' ||
        (current.status !== sprint.status &&
          !(current.status === 'planned' && sprint.status === 'active'))
      )
        throw new BadRequestException(
          'Состояние спринта изменилось; обновите данные',
        );
      sprint.initialSnapshot = current.initialSnapshot;
      sprint.finalSnapshot = current.finalSnapshot;
      sprint.retrospective = current.retrospective;
      if (current.status === 'planned' && sprint.status === 'active') {
        const active = await manager.findOneBy(Sprint, {
          projectId: sprint.projectId,
          status: 'active',
        });
        if (active)
          throw new BadRequestException('Another sprint is already active');
        const tasks = await manager.findBy(Task, { sprintId: sprint.id });
        const stories = await manager.findBy(BoardGroup, {
          sprintId: sprint.id,
          type: 'story',
        });
        const project = await manager.findOneByOrFail(Project, {
          id: sprint.projectId,
        });
        const statuses = storyWorkflow(project);
        sprint.initialSnapshot = planningSnapshot(
          tasks,
          stories.map((s) => normalizeStoryGroup(s, statuses)),
          new Date().toISOString(),
        );
      }
      return manager.save(Sprint, sprint);
    });
  }

  async delete(id: string, projectId: string): Promise<boolean> {
    const sprint = await this.findById(id, projectId);
    if (!sprint) return false;
    await this.repo.remove(sprint);
    return true;
  }

  async closeAndMoveUnfinished(
    sprintId: string,
    moveToSprintId: string | null,
    completion: SprintCompletion = {},
  ): Promise<void> {
    await this.dataSource.transaction((manager) =>
      completeSprintInTransaction(
        manager,
        sprintId,
        moveToSprintId,
        completion,
      ),
    );
  }

  async setGroupSprint(
    projectId: string,
    groupId: string,
    sprintId: string | null,
  ): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const group = await manager.findOneBy(BoardGroup, {
        id: groupId,
        projectId,
        type: 'story',
      });
      if (!group) throw new BadRequestException('История не найдена в проекте');
      await mutableSprint(manager, projectId, sprintId);
      const eligible =
        '(sprintId IS NULL OR sprintId NOT IN (SELECT id FROM sprints WHERE status = :closed))';
      await manager
        .createQueryBuilder()
        .update(BoardGroup)
        .set({ sprintId })
        .where('id = :groupId AND projectId = :projectId AND type = :story', {
          groupId,
          projectId,
          story: 'story',
        })
        .execute();
      const firstColumn =
        sprintId === null
          ? null
          : await manager.getRepository(ProjectColumn).findOne({
              where: { projectId },
              order: { order: 'ASC' },
            });
      if (sprintId !== null && !firstColumn) {
        const withoutColumn = await manager
          .getRepository(Task)
          .createQueryBuilder('task')
          .where('task.groupId = :groupId AND task.projectId = :projectId', {
            groupId,
            projectId,
          })
          .andWhere('task.columnId IS NULL')
          .andWhere(eligible, { closed: 'closed' })
          .getCount();
        if (withoutColumn > 0) {
          throw new BadRequestException(
            'Sprint tasks require a project column',
          );
        }
      }
      if (firstColumn) {
        await manager
          .createQueryBuilder()
          .update(Task)
          .set({ columnId: firstColumn.id })
          .where('groupId = :groupId AND projectId = :projectId', {
            groupId,
            projectId,
          })
          .andWhere('columnId IS NULL')
          .andWhere(eligible, { closed: 'closed' })
          .execute();
      }
      const result = await manager
        .createQueryBuilder()
        .update(Task)
        .set({ sprintId })
        .where('groupId = :groupId AND projectId = :projectId', {
          groupId,
          projectId,
        })
        .andWhere(eligible, { closed: 'closed' })
        .execute();
      return result.affected ?? 0;
    });
  }
  async removeGroupFromSprint(
    userId: number,
    projectId: string,
    sprintId: string,
    groupId: string,
  ): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.findOneBy(Project, {
        id: projectId,
        userId,
      });
      if (!project)
        throw new NotFoundException(`Project #${projectId} not found`);
      if (project.type !== 'agile') {
        throw new BadRequestException(
          'Sprint planning requires an Agile project',
        );
      }
      const sprint = await manager.findOneBy(Sprint, {
        id: sprintId,
        projectId,
        userId,
      });
      if (!sprint) throw new NotFoundException(`Sprint #${sprintId} not found`);
      if (sprint.status === 'closed') {
        throw new BadRequestException('Closed sprint cannot be changed');
      }
      const group = await manager.findOneBy(BoardGroup, {
        id: groupId,
        projectId,
        userId,
      });
      if (!group) throw new NotFoundException(`Group #${groupId} not found`);
      const children =
        group.type === 'epic'
          ? await manager.findBy(BoardGroup, {
              parentId: groupId,
              projectId,
              userId,
              type: 'story',
            })
          : [];
      const groupIds = [groupId, ...children.map((child) => child.id)];
      await manager.update(
        BoardGroup,
        {
          id: In(groupIds),
          projectId,
          userId,
          sprintId,
          type: 'story',
        },
        { sprintId: null },
      );
      const result = await manager.update(
        Task,
        {
          groupId: In(groupIds),
          projectId,
          userId,
          sprintId,
        },
        { sprintId: null },
      );
      return result.affected ?? 0;
    });
  }
}
