import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task, PomodoroConfig, TimerSession, User } from '../../shared/entities';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';
import { TaskRepositoryPort } from './domain/task-repository.port';
import { TimerSessionRepositoryPort } from './domain/timer-session-repository.port';
import { NotificationPort } from './domain/notification.port';
import { TypeOrmTaskRepository } from './infrastructure/typeorm-task.repository';
import { UserSettingsPort } from './domain/user-settings.port';
import { TypeOrmUserSettingsAdapter } from './infrastructure/typeorm-user-settings.adapter';
import { TypeOrmTimerSessionRepository } from './infrastructure/typeorm-timer-session.repository';
import { TelegramNotificationAdapter } from './infrastructure/telegram-notification.adapter';
import { CompositeNotificationAdapter } from './infrastructure/composite-notification.adapter';
import { TimerExpiryScheduler } from './infrastructure/timer-expiry.scheduler';
import { TaskService } from './task.service';
import { TimerSessionService } from './timer-session.service';
import { TaskController } from './task.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, PomodoroConfig, TimerSession, User]),
    AuthModule,
    UserModule,
    NotificationModule,
  ],
  controllers: [TaskController],
  providers: [
    { provide: TaskRepositoryPort, useClass: TypeOrmTaskRepository },
    {
      provide: TimerSessionRepositoryPort,
      useClass: TypeOrmTimerSessionRepository,
    },
    { provide: UserSettingsPort, useClass: TypeOrmUserSettingsAdapter },
    { provide: NotificationPort, useClass: CompositeNotificationAdapter },
    TelegramNotificationAdapter,
    TaskService,
    TimerSessionService,
    TimerExpiryScheduler,
  ],
  exports: [TaskService, TaskRepositoryPort],
})
export class TaskModule {}
