import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../../shared/entities';
import { ProjectRepositoryPort } from '../domain/project-repository.port';

@Injectable()
export class TypeOrmProjectRepository extends ProjectRepositoryPort {
  constructor(
    @InjectRepository(Project)
    private repo: Repository<Project>,
  ) {
    super();
  }

  async findAllByUser(userId: number): Promise<Project[]> {
    return this.repo.find({
      where: { userId },
      order: { order: 'ASC', createdAt: 'DESC' },
    });
  }

  async findById(id: string, userId: number): Promise<Project | null> {
    return this.repo.findOne({ where: { id, userId } });
  }

  async findByIdWithRelations(
    id: string,
    userId: number,
  ): Promise<Project | null> {
    return this.repo.findOne({
      where: { id, userId },
      relations: ['columns'],
    });
  }

  async create(data: Partial<Project>): Promise<Project> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async save(project: Project): Promise<Project> {
    return this.repo.save(project);
  }

  async delete(id: string, userId: number): Promise<boolean> {
    const project = await this.findById(id, userId);
    if (!project) return false;
    await this.repo.remove(project);
    return true;
  }

  async reorder(updates: { id: string; order: number }[]): Promise<void> {
    await Promise.all(
      updates.map(({ id, order }) => this.repo.update(id, { order })),
    );
  }
}
