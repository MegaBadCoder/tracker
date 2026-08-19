import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/test-app';

// Эти сценарии живут в e2e, а не в board-group.service.spec.ts, намеренно.
// Сервисный спек мокает репозиторий, поэтому ограничения схемы там не
// проверяются вообще — из-за этого NOT NULL на board_groups.userId проехал
// мимо 449 юнит-тестов, и создание любого эпика падало с 500 на живом API.
describe('Board groups (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let projectId: string;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    token = ctx.token;
  });

  afterAll(async () => {
    await app.close().catch(() => {});
  });

  const auth = () => `Bearer ${token}`;

  describe('agile-проект', () => {
    it('создаётся и засевает три колонки в нужном порядке', async () => {
      const { body: project } = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', auth())
        .send({ title: 'Agile e2e', viewMode: 'agile' })
        .expect(201);

      expect(project.viewMode).toBe('agile');
      projectId = project.id;

      const { body: columns } = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}/columns`)
        .set('Authorization', auth())
        .expect(200);

      expect(columns.map((c: { title: string }) => c.title)).toEqual([
        'К выполнению',
        'В работе',
        'Готово',
      ]);
    });

    it('list-проект колонок не засевает', async () => {
      const { body: project } = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', auth())
        .send({ title: 'List e2e', viewMode: 'list' })
        .expect(201);

      const { body: columns } = await request(app.getHttpServer())
        .get(`/api/projects/${project.id}/columns`)
        .set('Authorization', auth())
        .expect(200);

      expect(columns).toEqual([]);
    });
  });

  describe('эпики и истории', () => {
    let epicId: string;
    let storyId: string;

    it('создаёт эпик — регрессия на NOT NULL userId', async () => {
      const { body } = await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/groups`)
        .set('Authorization', auth())
        .send({ title: 'Онбординг' })
        .expect(201);

      expect(body).toMatchObject({
        type: 'epic',
        parentId: null,
        status: 'open',
      });
      expect(body.userId).toBeDefined();
      epicId = body.id;
    });

    it('создаёт историю внутри эпика', async () => {
      const { body } = await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/groups`)
        .set('Authorization', auth())
        .send({ title: 'Экран входа', parentId: epicId })
        .expect(201);

      expect(body).toMatchObject({ type: 'story', parentId: epicId });
      storyId = body.id;
    });

    it('отдаёт дерево: эпик с вложенной историей', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}/groups`)
        .set('Authorization', auth())
        .expect(200);

      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(epicId);
      expect(body[0].children.map((c: { id: string }) => c.id)).toEqual([
        storyId,
      ]);
    });

    it('третий уровень отклоняется с 400, а не с 500', async () => {
      await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/groups`)
        .set('Authorization', auth())
        .send({ title: 'Третий уровень', parentId: storyId })
        .expect(400);
    });

    it('группа не может стать родителем самой себе — 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/projects/${projectId}/groups/${storyId}`)
        .set('Authorization', auth())
        .send({ parentId: storyId })
        .expect(400);
    });

    it('закрытие эпика проставляет completedAt, открытие — обнуляет', async () => {
      const { body: done } = await request(app.getHttpServer())
        .patch(`/api/projects/${projectId}/groups/${epicId}`)
        .set('Authorization', auth())
        .send({ status: 'done' })
        .expect(200);
      expect(done.completedAt).not.toBeNull();

      const { body: reopened } = await request(app.getHttpServer())
        .patch(`/api/projects/${projectId}/groups/${epicId}`)
        .set('Authorization', auth())
        .send({ status: 'open' })
        .expect(200);
      expect(reopened.completedAt).toBeNull();
    });
  });

  describe('задача в ячейке', () => {
    let taskId: string;
    let columnId: string;
    let storyId: string;

    beforeAll(async () => {
      const { body: columns } = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}/columns`)
        .set('Authorization', auth());
      columnId = columns[1].id;

      const { body: tree } = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}/groups`)
        .set('Authorization', auth());
      storyId = tree[0].children[0].id;

      const { body: task } = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', auth())
        .send({ title: 'OAuth через Telegram', projectId })
        .expect(201);
      taskId = task.id;
    });

    it('move проставляет колонку и группу одним запросом', async () => {
      const { body } = await request(app.getHttpServer())
        .patch(`/api/projects/${projectId}/tasks/${taskId}/move`)
        .set('Authorization', auth())
        .send({ projectId, columnId, groupId: storyId, order: 0 })
        .expect(200);

      expect(body).toMatchObject({ columnId, groupId: storyId });
    });

    it('move без groupId группу не сбрасывает', async () => {
      const { body } = await request(app.getHttpServer())
        .patch(`/api/projects/${projectId}/tasks/${taskId}/move`)
        .set('Authorization', auth())
        .send({ projectId, columnId, order: 1 })
        .expect(200);

      expect(body.groupId).toBe(storyId);
    });

    it('перенос во Входящие обнуляет группу без 500', async () => {
      const { body } = await request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}/move-to-inbox`)
        .set('Authorization', auth())
        .send({})
        .expect(200);

      expect(body.projectId).toBeNull();
      expect(body.groupId).toBeNull();
    });
  });
});
