import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../../shared/entities';
import { ProjectTypeQueryPort } from '../domain/project-type.port';

// Реализация читает projects напрямую, а не через ProjectModule: ProjectModule
// уже импортирует TaskModule, и порт на стороне проекта замкнул бы цикл.
@Injectable()
export class TypeOrmProjectTypeAdapter extends ProjectTypeQueryPort {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {
    super();
  }

  async getType(projectId: string): Promise<'simple' | 'agile' | null> {
    const project = await this.projectRepo.findOneBy({ id: projectId });
    return project?.type ?? null;
  }
}
