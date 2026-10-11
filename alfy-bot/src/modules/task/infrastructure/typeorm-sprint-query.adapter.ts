import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectColumn, Sprint } from '../../../shared/entities';
import { SprintQueryPort, SprintStatusView } from '../domain/sprint-query.port';

// Реализация читает sprints и project_columns напрямую, а не через ProjectModule:
// ProjectModule уже импортирует TaskModule, и порт на стороне проекта замкнул бы цикл.
@Injectable()
export class TypeOrmSprintQueryAdapter extends SprintQueryPort {
  constructor(
    @InjectRepository(Sprint)
    private readonly sprintRepo: Repository<Sprint>,
    @InjectRepository(ProjectColumn)
    private readonly columnRepo: Repository<ProjectColumn>,
  ) {
    super();
  }

  async getSprint(
    sprintId: string,
  ): Promise<{ projectId: string; status: SprintStatusView } | null> {
    const sprint = await this.sprintRepo.findOneBy({ id: sprintId });
    return sprint
      ? { projectId: sprint.projectId, status: sprint.status }
      : null;
  }

  async firstColumnId(projectId: string): Promise<string | null> {
    const column = await this.columnRepo.findOne({
      where: { projectId },
      order: { order: 'ASC' },
    });
    return column?.id ?? null;
  }
}
