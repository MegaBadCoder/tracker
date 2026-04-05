import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Project } from '../../shared/entities';
import { ProjectRepositoryPort } from './domain/project-repository.port';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectService {
  constructor(private readonly projectRepo: ProjectRepositoryPort) {}

  async getAll(userId: number): Promise<Project[]> {
    return this.projectRepo.findAllByUser(userId);
  }

  async getById(userId: number, id: string): Promise<Project> {
    const project = await this.projectRepo.findByIdWithRelations(id, userId);
    if (!project) throw new NotFoundException(`Project #${id} not found`);
    return project;
  }

  async create(userId: number, dto: CreateProjectDto): Promise<Project> {
    if (dto.parentId) {
      const parent = await this.projectRepo.findById(dto.parentId, userId);
      if (!parent) throw new NotFoundException(`Parent project #${dto.parentId} not found`);
      if (parent.userId !== userId) throw new ForbiddenException('Parent project belongs to another user');
    }

    return this.projectRepo.create({
      userId,
      title: dto.title,
      description: dto.description,
      parentId: dto.parentId ?? null,
      viewMode: dto.viewMode ?? 'list',
      icon: dto.icon,
      color: dto.color,
    });
  }

  async update(userId: number, id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.projectRepo.findById(id, userId);
    if (!project) throw new NotFoundException(`Project #${id} not found`);

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new BadRequestException('Project cannot be its own parent');
      }
      const parent = await this.projectRepo.findById(dto.parentId, userId);
      if (!parent) throw new NotFoundException(`Parent project #${dto.parentId} not found`);
      if (parent.userId !== userId) throw new ForbiddenException('Parent project belongs to another user');
    }

    Object.assign(project, dto);
    return this.projectRepo.save(project);
  }

  async delete(userId: number, id: string): Promise<void> {
    const deleted = await this.projectRepo.delete(id, userId);
    if (!deleted) throw new NotFoundException(`Project #${id} not found`);
  }

  async reorder(userId: number, orderedIds: string[]): Promise<void> {
    if (orderedIds.length === 0) {
      throw new BadRequestException('Ordered IDs array cannot be empty');
    }
    const updates = orderedIds.map((id, index) => ({ id, order: index }));
    await this.projectRepo.reorder(updates);
  }
}
