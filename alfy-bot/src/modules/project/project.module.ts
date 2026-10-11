import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Project,
  ProjectColumn,
  BoardGroup,
  Sprint,
  Release,
} from '../../shared/entities';
import { AuthModule } from '../auth/auth.module';
import { TaskModule } from '../task/task.module';
import { ProjectRepositoryPort } from './domain/project-repository.port';
import { ProjectColumnRepositoryPort } from './domain/project-column-repository.port';
import { BoardGroupRepositoryPort } from './domain/board-group-repository.port';
import { SprintRepositoryPort } from './domain/sprint-repository.port';
import { ReleaseRepositoryPort } from './domain/release-repository.port';
import { TypeOrmProjectRepository } from './infrastructure/typeorm-project.repository';
import { TypeOrmProjectColumnRepository } from './infrastructure/typeorm-project-column.repository';
import { TypeOrmBoardGroupRepository } from './infrastructure/typeorm-board-group.repository';
import { TypeOrmSprintRepository } from './infrastructure/typeorm-sprint.repository';
import { TypeOrmReleaseRepository } from './infrastructure/typeorm-release.repository';
import { ProjectService } from './project.service';
import { ProjectColumnService } from './project-column.service';
import { BoardGroupService } from './board-group.service';
import { ProjectTaskService } from './project-task.service';
import { SprintService } from './sprint.service';
import { ReleaseService } from './release.service';
import { ProjectController } from './project.controller';
import { ProjectColumnController } from './project-column.controller';
import { BoardGroupController } from './board-group.controller';
import { ProjectTaskController } from './project-task.controller';
import { SprintController } from './sprint.controller';
import { ReleaseController } from './release.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectColumn,
      BoardGroup,
      Sprint,
      Release,
    ]),
    AuthModule,
    TaskModule,
  ],
  controllers: [
    ProjectController,
    ProjectColumnController,
    BoardGroupController,
    ProjectTaskController,
    SprintController,
    ReleaseController,
  ],
  providers: [
    { provide: ProjectRepositoryPort, useClass: TypeOrmProjectRepository },
    {
      provide: ProjectColumnRepositoryPort,
      useClass: TypeOrmProjectColumnRepository,
    },
    {
      provide: BoardGroupRepositoryPort,
      useClass: TypeOrmBoardGroupRepository,
    },
    {
      provide: SprintRepositoryPort,
      useClass: TypeOrmSprintRepository,
    },
    {
      provide: ReleaseRepositoryPort,
      useClass: TypeOrmReleaseRepository,
    },
    ProjectService,
    ProjectColumnService,
    BoardGroupService,
    ProjectTaskService,
    SprintService,
    ReleaseService,
  ],
  exports: [ProjectService],
})
export class ProjectModule {}
