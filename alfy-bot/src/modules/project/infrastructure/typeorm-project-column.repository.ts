import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
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

  async delete(
    id: string,
    projectId: string,
    isAgile: boolean,
  ): Promise<boolean> {
    if (isAgile) {
      const result = await this.repo
        .createQueryBuilder()
        .delete()
        .from(ProjectColumn)
        .where('id = :id AND projectId = :projectId', { id, projectId })
        .andWhere(
          'NOT EXISTS (SELECT 1 FROM tasks WHERE tasks.columnId = project_columns.id)',
        )
        .execute();
      if (result.affected) return true;
      if (await this.findById(id, projectId)) {
        throw new ConflictException(
          'Нельзя удалить колонку, пока в ней есть задачи. Сначала перенесите задачи в другую колонку.',
        );
      }
      return false;
    }

    const column = await this.findById(id, projectId);
    if (!column) return false;
    await this.repo.remove(column);
    return true;
  }

  async reorder(
    projectId: string,
    updates: { id: string; order: number }[],
  ): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      const columns = await manager
        .getRepository(ProjectColumn)
        .find({ where: { projectId } });
      const ids = new Set(columns.map((column) => column.id));
      if (
        updates.length !== columns.length ||
        new Set(updates.map((update) => update.id)).size !== columns.length ||
        updates.some((update) => !ids.has(update.id))
      ) {
        throw new BadRequestException(
          'Укажите все колонки проекта без повторов',
        );
      }
      for (const { id, order } of updates) {
        await manager.update(ProjectColumn, { id, projectId }, { order });
      }
    });
  }
}
