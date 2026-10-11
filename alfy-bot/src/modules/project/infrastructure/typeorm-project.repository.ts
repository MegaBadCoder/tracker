import { planProjectMove } from '../lib/plan-project-move';
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

  async move(userId: number, id: string, parentId: string | null, beforeId: string | null): Promise<Project[]> {
    return this.repo.manager.transaction(async manager => {
      const repository = manager.getRepository(Project);
      const projects = await repository.find({ where: { userId }, order: { order: 'ASC', createdAt: 'DESC' } });
      const updated = planProjectMove(projects, id, parentId, beforeId);
      const previous = new Map(projects.map(project => [project.id, project]));
      for (const project of updated) {
        const old = previous.get(project.id)!;
        if (old.parentId !== project.parentId || old.order !== project.order) {
          await repository.update({ id: project.id, userId }, { parentId: project.parentId, order: project.order });
        }
      }
      return updated;
    });
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
