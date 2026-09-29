import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegrafModule } from 'nestjs-telegraf';
import { session } from 'telegraf';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { BotModule } from './modules/bot/bot.module';
import { isTelegramEnabled } from './shared/config/telegram-enabled';
import { GoalModule } from './modules/goal/goal.module';
import { QuestionModule } from './modules/question/question.module';
import { ReportModule } from './modules/report/report.module';
import { TaskModule } from './modules/task/task.module';
import { ProjectModule } from './modules/project/project.module';
import { NotificationModule } from './modules/notification/notification.module';
import { EventsModule } from './modules/events/events.module';
import { UserModule } from './modules/user/user.module';
import {
  Goal,
  Question,
  Schedule,
  ReportAnswer,
  User,
  AuthMethod,
  Task,
  PomodoroConfig,
  TimerSession,
  PushSubscription,
  Project,
  ProjectColumn,
  BoardGroup,
  ApiToken,
  Link,
} from './shared/entities';
import { ScheduleMigrationService } from './shared/database/schedule-migration.service';
import { BoardGroupConstraintsMigrationService } from './shared/database/board-group-constraints.service';
import { initializeWithSchemaSync } from './shared/database/create-data-source';
import { ProjectTypeMigrationService } from './shared/database/project-type-migration.service';
import { QuestionMigrationService } from './shared/database/question-migration.service';
import { AuthMethodMigrationService } from './shared/database/auth-method-migration.service';
import { RecurringSeriesRepairService } from './shared/database/recurring-series-repair.service';
import { SharedModule } from './shared/shared.module';

const telegramImports = isTelegramEnabled()
  ? [
      TelegrafModule.forRoot({
        token: process.env.BOT_TOKEN || '',
        middlewares: [session()],
      }),
      BotModule,
    ]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'sqlite',
        database: 'data/database.sqlite',
        entities: [
          User,
          AuthMethod,
          Goal,
          Question,
          ReportAnswer,
          Schedule,
          Task,
          PomodoroConfig,
          TimerSession,
          PushSubscription,
          Project,
          ProjectColumn,
          BoardGroup,
          ApiToken,
          Link,
        ],
        synchronize: true,
      }),
      dataSourceFactory: (options) => {
        if (!options) {
          throw new Error(
            'TypeOrmModule did not provide DataSourceOptions to dataSourceFactory',
          );
        }
        return initializeWithSchemaSync(options);
      },
    }),
    ...telegramImports,
    SharedModule,
    UserModule,
    AuthModule,
    GoalModule,
    QuestionModule,
    ReportModule,
    TaskModule,
    ProjectModule,
    NotificationModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ScheduleMigrationService,
    QuestionMigrationService,
    AuthMethodMigrationService,
    RecurringSeriesRepairService,
    BoardGroupConstraintsMigrationService,
    ProjectTypeMigrationService,
  ],
})
export class AppModule {}
