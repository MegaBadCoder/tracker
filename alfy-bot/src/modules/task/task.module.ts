import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task, PomodoroConfig, TimerSession } from '../../shared/entities';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { TaskRepositoryPort } from './domain/task-repository.port';
import { TypeOrmTaskRepository } from './infrastructure/typeorm-task.repository';
import { TaskService } from './task.service';
import { TimerSessionService } from './timer-session.service';
import { TaskController } from './task.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, PomodoroConfig, TimerSession]),
    AuthModule,
    UserModule,
  ],
  controllers: [TaskController],
  providers: [
    { provide: TaskRepositoryPort, useClass: TypeOrmTaskRepository },
    TaskService,
    TimerSessionService,
  ],
  exports: [TaskService],
})
export class TaskModule {}
