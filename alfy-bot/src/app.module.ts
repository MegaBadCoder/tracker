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
import { GoalModule } from './modules/goal/goal.module';
import { ReportModule } from './modules/report/report.module';
import { UserModule } from './modules/user/user.module';
import {
  Goal,
  GoalQuestion,
  GoalSchedule,
  ReportAnswer,
  User,
} from './shared/entities';
import { ScheduleMigrationService } from './shared/database/schedule-migration.service';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'data/database.sqlite',
      entities: [User, Goal, GoalQuestion, ReportAnswer, GoalSchedule],
      synchronize: true,
    }),
    TelegrafModule.forRoot({
      token: process.env.BOT_TOKEN || '',
      middlewares: [session()],
    }),
    SharedModule,
    UserModule,
    AuthModule,
    GoalModule,
    ReportModule,
    BotModule,
  ],
  controllers: [AppController],
  providers: [AppService, ScheduleMigrationService],
})
export class AppModule { }
