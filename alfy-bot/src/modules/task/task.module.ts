import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Task,
  PomodoroConfig,
  TimerSession,
  User,
  Link,
  Goal,
} from '../../shared/entities';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';
import { EventsModule } from '../events/events.module';
import { TaskRepositoryPort } from './domain/task-repository.port';
import { TaskLinkPort } from './domain/task-link.port';
import { TimerSessionRepositoryPort } from './domain/timer-session-repository.port';
import { NotificationPort } from './domain/notification.port';
import { TelegramUserLookupPort } from './domain/telegram-user-lookup.port';
import { TypeOrmTaskRepository } from './infrastructure/typeorm-task.repository';
import { TypeOrmTaskLinkRepository } from './infrastructure/typeorm-task-link.repository';
import { UserSettingsPort } from './domain/user-settings.port';
import { TypeOrmUserSettingsAdapter } from './infrastructure/typeorm-user-settings.adapter';
import { TypeOrmTimerSessionRepository } from './infrastructure/typeorm-timer-session.repository';
import { TelegramNotificationAdapter } from './infrastructure/telegram-notification.adapter';
import { TelegramUserLookupAdapter } from './infrastructure/telegram-user-lookup.adapter';
import { CompositeNotificationAdapter } from './infrastructure/composite-notification.adapter';
import { WebPushNotificationAdapter } from '../notification/web-push-notification.adapter';
import { isTelegramEnabled } from '../../shared/config/telegram-enabled';
import { TimerExpiryScheduler } from './infrastructure/timer-expiry.scheduler';
import { OverdueRecurringScheduler } from './infrastructure/overdue-recurring.scheduler';
import { TaskService } from './task.service';
import { TimerSessionService } from './timer-session.service';
import { OverdueRecurringService } from './overdue-recurring.service';
import { TaskController } from './task.controller';
import { TaskGoalQueryPort } from './domain/task-goal-query.port';

const notificationProviders = isTelegramEnabled()
  ? [
      { provide: NotificationPort, useClass: CompositeNotificationAdapter },
      TelegramNotificationAdapter,
    ]
  : [{ provide: NotificationPort, useExisting: WebPushNotificationAdapter }];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      PomodoroConfig,
      TimerSession,
      User,
      Link,
      Goal,
    ]),
    AuthModule,
    UserModule,
    NotificationModule,
    EventsModule,
  ],
  controllers: [TaskController],
  providers: [
    { provide: TaskRepositoryPort, useClass: TypeOrmTaskRepository },
    { provide: TaskLinkPort, useClass: TypeOrmTaskLinkRepository },
    {
      provide: TimerSessionRepositoryPort,
      useClass: TypeOrmTimerSessionRepository,
    },
    { provide: UserSettingsPort, useClass: TypeOrmUserSettingsAdapter },
    ...notificationProviders,
    {
      provide: TelegramUserLookupPort,
      useClass: TelegramUserLookupAdapter,
    },
    TaskService,
    TimerSessionService,
    TimerExpiryScheduler,
    OverdueRecurringService,
    OverdueRecurringScheduler,
    { provide: TaskGoalQueryPort, useExisting: TaskService },
  ],
  exports: [TaskService, TaskRepositoryPort, TaskGoalQueryPort],
})
export class TaskModule {}
