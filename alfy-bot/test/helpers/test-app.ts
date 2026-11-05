import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import { createSerializedSqliteDataSource } from '../../src/shared/database/serialized-sqlite';
import { AppModule } from '../../src/app.module';
import {
  User,
  Task,
  TaskDependency,
  PomodoroConfig,
  TimerSession,
  Goal,
  Question,
  Schedule,
  ReportAnswer,
  Project,
  ProjectColumn,
  BoardGroup,
  Sprint,
  SprintEvent,
  PlanningUndo,
  Release,
  AuthMethod,
  PushSubscription,
  ApiToken,
  Link,
} from '../../src/shared/entities';

export interface TestContext {
  app: INestApplication;
  token: string;
  userId: number;
}

export async function createTestApp(): Promise<TestContext> {
  process.env.JWT_SECRET = 'test-secret';
  process.env.BOT_TOKEN = 'test-bot-token';
  process.env.ENABLE_TELEGRAM = 'false';

  const testDataSource = createSerializedSqliteDataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [
      User,
      Task,
      TaskDependency,
      PomodoroConfig,
      TimerSession,
      Goal,
      Question,
      Schedule,
      ReportAnswer,
      Project,
      ProjectColumn,
      BoardGroup,
      Sprint,
      SprintEvent,
      PlanningUndo,
      Release,
      AuthMethod,
      PushSubscription,
      ApiToken,
      Link,
    ],
    synchronize: true,
  });
  await testDataSource.initialize();

  const module = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(getDataSourceToken())
    .useValue(testDataSource)
    .compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const userRepo = testDataSource.getRepository(User);
  const user = await userRepo.save({
    telegramId: 999,
    username: 'test',
  });

  const jwtService = module.get(JwtService);
  const token = jwtService.sign({ telegramId: 999, sub: user.id });

  return { app, token, userId: user.id };
}
