import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/test-app';

describe('Tasks (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    token = ctx.token;
  });

  afterAll(async () => {
    await app.close().catch(() => {});
  });

  describe('POST /api/tasks', () => {
    it('creates a simple task', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Test task' })
        .expect(201);

      expect(body).toMatchObject({
        title: 'Test task',
        completed: false,
      });
      expect(body.id).toBeDefined();
    });

    it('creates a task with all fields', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Full task',
          description: 'A detailed description',
          priority: 'high',
          dueDate: '2026-03-20T00:00:00.000Z',
          deadline: '2026-03-25T00:00:00.000Z',
          location: 'Office',
          tags: ['work', 'important'],
        })
        .expect(201);

      expect(body).toMatchObject({
        title: 'Full task',
        description: 'A detailed description',
        priority: 'high',
        location: 'Office',
        tags: ['work', 'important'],
      });
      expect(body.dueDate).toBeTruthy();
      expect(body.deadline).toBeTruthy();
    });

    it('creates a task with pomodoroConfig', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Pomodoro task',
          isPomodoroTask: true,
          pomodoroCount: 4,
          pomodoroDuration: 25,
          shortBreak: 5,
          longBreak: 15,
          longBreakInterval: 4,
        })
        .expect(201);

      expect(body.pomodoroConfig).toMatchObject({
        pomodoroCount: 4,
        pomodoroDuration: 25,
        shortBreak: 5,
        longBreak: 15,
        longBreakInterval: 4,
      });
    });

    it('returns 400 without title', async () => {
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'No title' })
        .expect(400);
    });

    it('returns dates as ISO strings after creation', async () => {
      const dueDate = '2026-03-20T00:00:00.000Z';
      const deadline = '2026-03-25T00:00:00.000Z';
      const { body } = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Date task', dueDate, deadline })
        .expect(201);

      expect(new Date(body.dueDate).toISOString()).toBe(dueDate);
      expect(new Date(body.deadline).toISOString()).toBe(deadline);
    });

    it('returns 400 for invalid date', async () => {
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Bad date', dueDate: 'not-a-date' })
        .expect(400);
    });

    it('returns 400 for invalid priority', async () => {
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Bad priority', priority: 123 })
        .expect(400);
    });
  });

  describe('GET /api/tasks', () => {
    it('returns all tasks for the user', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('PATCH /api/tasks/:id', () => {
    let taskId: string;

    beforeAll(async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'To update' })
        .expect(201);
      taskId = body.id;
    });

    it('updates the title', async () => {
      const { body } = await request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated title' })
        .expect(200);

      expect(body.title).toBe('Updated title');
    });

    it('toggles completed', async () => {
      const { body } = await request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true })
        .expect(200);

      expect(body.completed).toBe(true);
    });

    it('updates dates', async () => {
      const { body } = await request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ dueDate: '2026-04-01T00:00:00.000Z' })
        .expect(200);

      expect(body.dueDate).toBeTruthy();
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    let taskId: string;

    beforeAll(async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'To delete' })
        .expect(201);
      taskId = body.id;
    });

    it('deletes the task', async () => {
      await request(app.getHttpServer())
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('task is no longer returned', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(body.find((t: { id: string }) => t.id === taskId)).toBeUndefined();
    });
  });

  describe('Auth', () => {
    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/tasks')
        .expect(401);
    });

    it('returns 401 with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/tasks')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
