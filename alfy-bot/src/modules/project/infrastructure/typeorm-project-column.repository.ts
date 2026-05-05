import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectColumn } from '../../../shared/entities';
import { ProjectColumnRepositoryPort } from '../domain/project-column-repository.port';

@Injectable()
export class TypeOrmProjectColumnRepository extends ProjectColumnRepositoryPort {
  constructor(
    @InjectRepository(ProjectColumn)
    private repo: Repository<ProjectColumn>,
  ) {
    super();
  }

  async findAllByProject(projectId: string): Promise<ProjectColumn[]> {
    return this.repo.find({
      where: { projectId },
      order: { order: 'ASC' },
    });
  }

  async findById(id: string, projectId: string): Promise<ProjectColumn | null> {
    return this.repo.findOne({ where: { id, projectId } });
  }

  async create(data: Partial<ProjectColumn>): Promise<ProjectColumn> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async save(column: ProjectColumn): Promise<ProjectColumn> {
    return this.repo.save(column);
  }

  async delete(id: string, projectId: string): Promise<boolean> {
    const column = await this.findById(id, projectId);
    if (!column) return false;
    await this.repo.remove(column);
    return true;
  }

  async reorder(updates: { id: string; order: number }[]): Promise<void> {
    await Promise.all(
      updates.map(({ id, order }) => this.repo.update(id, { order })),
    );
  }
}
