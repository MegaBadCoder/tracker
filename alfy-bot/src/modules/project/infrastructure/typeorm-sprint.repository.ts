import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  BoardGroup,
  ProjectColumn,
  Sprint,
  Task,
} from '../../../shared/entities';
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
    return this.repo.save(sprint);
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
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Sprint, sprintId, {
        status: 'closed',
        completedAt: new Date(),
      });
      await manager.update(
        Task,
        { sprintId, completed: false },
        { sprintId: moveToSprintId },
      );
      await manager.update(
        BoardGroup,
        { sprintId, status: 'open', type: 'story' },
        { sprintId: moveToSprintId },
      );
    });
  }

  async setGroupSprint(
    projectId: string,
    groupId: string,
    sprintId: string | null,
  ): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
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
}
