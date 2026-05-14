import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project, ProjectColumn } from '../../shared/entities';
import { AuthModule } from '../auth/auth.module';
import { TaskModule } from '../task/task.module';
import { ProjectRepositoryPort } from './domain/project-repository.port';
import { ProjectColumnRepositoryPort } from './domain/project-column-repository.port';
import { TypeOrmProjectRepository } from './infrastructure/typeorm-project.repository';
import { TypeOrmProjectColumnRepository } from './infrastructure/typeorm-project-column.repository';
import { ProjectService } from './project.service';
import { ProjectColumnService } from './project-column.service';
import { ProjectTaskService } from './project-task.service';
import { ProjectController } from './project.controller';
import { ProjectColumnController } from './project-column.controller';
import { ProjectTaskController } from './project-task.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectColumn]),
    AuthModule,
    TaskModule,
  ],
  controllers: [
    ProjectController,
    ProjectColumnController,
    ProjectTaskController,
  ],
  providers: [
    { provide: ProjectRepositoryPort, useClass: TypeOrmProjectRepository },
    {
      provide: ProjectColumnRepositoryPort,
      useClass: TypeOrmProjectColumnRepository,
    },
    ProjectService,
    ProjectColumnService,
    ProjectTaskService,
  ],
  exports: [ProjectService],
})
export class ProjectModule {}
