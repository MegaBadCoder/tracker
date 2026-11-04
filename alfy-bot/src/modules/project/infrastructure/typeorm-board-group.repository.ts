import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BoardGroup } from '../../../shared/entities';
import { BoardGroupRepositoryPort } from '../domain/board-group-repository.port';

@Injectable()
export class TypeOrmBoardGroupRepository extends BoardGroupRepositoryPort {
  constructor(
    @InjectRepository(BoardGroup)
    private repo: Repository<BoardGroup>,
  ) {
    super();
  }

  async findAllByProject(projectId: string): Promise<BoardGroup[]> {
    return this.repo.find({
      where: { projectId },
      order: { order: 'ASC' },
    });
  }

  async findById(id: string, projectId: string): Promise<BoardGroup | null> {
    return this.repo.findOne({ where: { id, projectId } });
  }

  async countChildren(id: string): Promise<number> {
    return this.repo.count({ where: { parentId: id } });
  }

  async create(data: Partial<BoardGroup>): Promise<BoardGroup> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async save(group: BoardGroup): Promise<BoardGroup> {
    const fields = [
      'parentId',
      'type',
      'title',
      'description',
      'color',
      'startDate',
      'dueDate',
      'status',
      'completedAt',
      'workflowStatusId',
      'blockedReason',
      'deferredUntil',
      'archived',
      'dependencyIds',
    ] as const;
    const changes = Object.fromEntries(
      fields.map((field) => [field, group[field]]),
    );
    const result = await this.repo.update(
      { id: group.id, projectId: group.projectId },
      changes,
    );
    if (result.affected !== 1) throw new NotFoundException('Группа не найдена');
    const saved = await this.findById(group.id, group.projectId);
    if (!saved) throw new NotFoundException('Группа не найдена');
    return saved;
  }

  async delete(id: string, projectId: string): Promise<boolean> {
    const group = await this.findById(id, projectId);
    if (!group) return false;
    await this.repo.remove(group);
    return true;
  }

  async reorder(
    projectId: string,
    updates: { id: string; order: number }[],
  ): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      for (const { id, order } of updates) {
        const result = await manager.update(
          BoardGroup,
          { id, projectId },
          { order },
        );
        if (result.affected !== 1) {
          throw new BadRequestException(
            'Group no longer belongs to this project',
          );
        }
      }
    });
  }
}
