import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Release } from '../../../shared/entities';
import {
  ReleaseQueryPort,
  ReleaseStatusView,
} from '../domain/release-query.port';

// Реализация читает releases напрямую, а не через ProjectModule:
// ProjectModule уже импортирует TaskModule, и порт на стороне проекта замкнул бы цикл.
@Injectable()
export class TypeOrmReleaseQueryAdapter extends ReleaseQueryPort {
  constructor(
    @InjectRepository(Release)
    private readonly releaseRepo: Repository<Release>,
  ) {
    super();
  }

  async getRelease(
    releaseId: string,
  ): Promise<{ projectId: string; status: ReleaseStatusView } | null> {
    const release = await this.releaseRepo.findOneBy({ id: releaseId });
    return release
      ? { projectId: release.projectId, status: release.status }
      : null;
  }
}
