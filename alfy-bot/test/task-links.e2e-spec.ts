import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { Goal, Task, User } from '../src/shared/entities';
import { createTestApp } from './helpers/test-app';

describe('Task links (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let otherToken: string;
  let taskId: string;
  let goalId: number;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    token = ctx.token;
    const dataSource = app.get(DataSource);
    const otherUser = await dataSource
      .getRepository(User)
      .save({ telegramId: 123456, username: 'other' });
    otherToken = app
      .get(JwtService)
      .sign({ sub: otherUser.id, telegramId: 123456 });
    const goal = await dataSource
      .getRepository(Goal)
      .save({ goal_name: 'Цель задачи', user_id: ctx.userId });
    goalId = goal.id;
    const response = await request(app.getHttpServer())
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Задача по ссылке',
        description: '[Документ](https://example.com)',
        priority: 'high',
        tags: ['link'],
        isPomodoroTask: true,
        pomodoroCount: 4,
        goalIds: [goalId],
      })
      .expect(201);
    taskId = (response.body as Task).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('возвращает все поля списка, включая цели и конфигурацию помодоро', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const single = await request(app.getHttpServer())
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const task = single.body as Task;
    expect(task).toEqual(
      (list.body as Task[]).find((item) => item.id === taskId),
    );
    expect(task.goalIds).toEqual([goalId]);
    expect(task.pomodoroConfig).toMatchObject({ pomodoroCount: 4 });
  });

  it('возвращает 404 для чужой задачи', async () => {
    await request(app.getHttpServer())
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('возвращает 404 для отсутствующей задачи', async () => {
    await request(app.getHttpServer())
      .get('/api/tasks/00000000-0000-4000-8000-000000000001')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('требует авторизацию', async () => {
    await request(app.getHttpServer()).get(`/api/tasks/${taskId}`).expect(401);
  });

  it('отклоняет некорректный UUID', async () => {
    await request(app.getHttpServer())
      .get('/api/tasks/not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('сохраняет статический маршрут таймера', async () => {
    await request(app.getHttpServer())
      .put('/api/tasks/timer')
      .set('Authorization', `Bearer ${token}`)
      .send({ taskId, phase: 1, isActive: true })
      .expect(200);
    const response = await request(app.getHttpServer())
      .get('/api/tasks/timer')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body as unknown).toMatchObject({
      taskId,
      phase: 1,
      isActive: true,
    });
  });
});
