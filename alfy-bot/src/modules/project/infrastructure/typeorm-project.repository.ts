import { planProjectMove } from '../lib/plan-project-move';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../../shared/entities';
import { ProjectRepositoryPort } from '../domain/project-repository.port';

@Injectable()
export class TypeOrmProjectRepository extends ProjectRepositoryPort {
  private moveQueue: Promise<void> = Promise.resolve();

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

  async update(userId: number, id: string, changes: Partial<Project>): Promise<Project> {
    const provided = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
    const result = await this.writeTree(userId, projects => {
      const current = projects.find(project => project.id === id);
      if (!current) throw new NotFoundException('Project not found');
      const updated = changes.parentId !== undefined && changes.parentId !== current.parentId
        ? planProjectMove(projects, id, changes.parentId, null)
        : projects;
      return updated.map(project => project.id === id ? { ...project, ...provided } : project);
    });
    return result.find(project => project.id === id)!;
  }

  async move(userId: number, id: string, parentId: string | null, beforeId: string | null): Promise<Project[]> {
    return this.writeTree(userId, projects => planProjectMove(projects, id, parentId, beforeId));
  }

  private writeTree(userId: number, transform: (projects: Project[]) => Project[]): Promise<Project[]> {
    const result = this.moveQueue.then(() => this.writeTreeInTransaction(userId, transform));
    this.moveQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async writeTreeInTransaction(userId: number, transform: (projects: Project[]) => Project[]): Promise<Project[]> {
    return this.repo.manager.transaction(async manager => {
      const repository = manager.getRepository(Project);
      const projects = await repository.find({ where: { userId }, order: { order: 'ASC', createdAt: 'DESC' } });
      const updated = transform(projects);
      const previous = new Map(projects.map(project => [project.id, project]));
      const fields = ['parentId', 'order', 'title', 'description', 'viewMode', 'icon', 'color'] as const;
      for (const project of updated) {
        const old = previous.get(project.id)!;
        const changes = Object.fromEntries(fields.filter(field => old[field] !== project[field]).map(field => [field, project[field]]));
        if (Object.keys(changes).length) await repository.update({ id: project.id, userId }, changes);
      }
      return repository.find({ where: { userId }, order: { order: 'ASC', createdAt: 'DESC' } });
    });
  }

  async delete(id: string, userId: number): Promise<boolean> {
    const project = await this.findById(id, userId);
    if (!project) return false;
    await this.repo.remove(project);
    return true;
  }

  async reorder(userId: number, updates: { id: string; order: number }[]): Promise<void> {
    await this.writeTree(userId, projects => {
      const owned = new Set(projects.map(project => project.id));
      if (updates.some(update => !owned.has(update.id))) throw new NotFoundException('Project not found');
      const orders = new Map(updates.map(update => [update.id, update.order]));
      return projects.map(project => orders.has(project.id) ? { ...project, order: orders.get(project.id)! } : project);
    });
  }
}
