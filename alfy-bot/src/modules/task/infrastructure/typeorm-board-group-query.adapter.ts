import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BoardGroup } from '../../../shared/entities';
import { BoardGroupQueryPort } from '../domain/board-group-query.port';

// Реализация читает board_groups напрямую, а не через ProjectModule: ProjectModule
// уже импортирует TaskModule, и порт на стороне проекта замкнул бы цикл.
@Injectable()
export class TypeOrmBoardGroupQueryAdapter extends BoardGroupQueryPort {
  constructor(
    @InjectRepository(BoardGroup)
    private readonly boardGroupRepo: Repository<BoardGroup>,
  ) {
    super();
  }

  async getProjectId(groupId: string): Promise<string | null> {
    const group = await this.boardGroupRepo.findOneBy({ id: groupId });
    return group?.projectId ?? null;
  }
}
