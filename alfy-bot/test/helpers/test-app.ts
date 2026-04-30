import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  User,
  Task,
  PomodoroConfig,
  TimerSession,
  Goal,
  Question,
  Schedule,
  ReportAnswer,
  Project,
  ProjectColumn,
} from '../../src/shared/entities';

export interface TestContext {
  app: INestApplication;
  token: string;
  userId: number;
}

export async function createTestApp(): Promise<TestContext> {
  process.env.JWT_SECRET = 'test-secret';
  process.env.BOT_TOKEN = 'test-bot-token';

  const testDataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [
      User,
      Task,
      PomodoroConfig,
      TimerSession,
      Goal,
      Question,
      Schedule,
      ReportAnswer,
      Project,
      ProjectColumn,
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
