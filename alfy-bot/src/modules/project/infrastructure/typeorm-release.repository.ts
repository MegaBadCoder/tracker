import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Release, Task } from '../../../shared/entities';
import { ReleaseRepositoryPort } from '../domain/release-repository.port';

@Injectable()
export class TypeOrmReleaseRepository extends ReleaseRepositoryPort {
  constructor(
    @InjectRepository(Release)
    private repo: Repository<Release>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {
    super();
  }

  async findAllByProject(projectId: string): Promise<Release[]> {
    return this.repo.find({
      where: { projectId },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  async findById(id: string, projectId: string): Promise<Release | null> {
    return this.repo.findOne({ where: { id, projectId } });
  }

  async create(data: Partial<Release>): Promise<Release> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async save(release: Release): Promise<Release> {
    return this.repo.save(release);
  }

  async delete(id: string, projectId: string): Promise<boolean> {
    const release = await this.findById(id, projectId);
    if (!release) return false;
    await this.repo.remove(release);
    return true;
  }

  async releaseAndMoveUnfinished(
    releaseId: string,
    moveToReleaseId: string | null,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Release, releaseId, {
        status: 'released',
        releasedAt: new Date(),
      });
      await manager.update(
        Task,
        { releaseId, completed: false },
        { releaseId: moveToReleaseId },
      );
    });
  }

  async assignGroupTasks(
    releaseId: string,
    groupIds: string[],
  ): Promise<number> {
    if (groupIds.length === 0) return 0;
    const release = await this.repo.findOneByOrFail({ id: releaseId });
    const result = await this.dataSource
      .createQueryBuilder()
      .update(Task)
      .set({ releaseId })
      .where('groupId IN (:...groupIds)', { groupIds })
      .andWhere('projectId = :projectId', { projectId: release.projectId })
      .andWhere(
        '(releaseId IS NULL OR releaseId NOT IN (SELECT id FROM releases WHERE status = :released))',
        { released: 'released' },
      )
      .execute();
    return result.affected ?? 0;
  }
}
