import { Injectable } from '@nestjs/common';
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
    return this.repo.save(group);
  }

  async delete(id: string, projectId: string): Promise<boolean> {
    const group = await this.findById(id, projectId);
    if (!group) return false;
    await this.repo.remove(group);
    return true;
  }

  async reorder(updates: { id: string; order: number }[]): Promise<void> {
    await Promise.all(
      updates.map(({ id, order }) => this.repo.update(id, { order })),
    );
  }
}
