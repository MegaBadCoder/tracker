import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Sprint, Task } from '../../../shared/entities';
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
    });
  }
}
