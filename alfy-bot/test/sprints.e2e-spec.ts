import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/test-app';
import { Task } from '../src/shared/entities';

interface SprintBody {
  id: string;
  name: string;
  status: string;
  completedAt: string | null;
}

describe('Sprints (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let userId: number;
  let projectId: string;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    token = ctx.token;
    userId = ctx.userId;
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close().catch(() => {});
  });

  const auth = () => `Bearer ${token}`;
  const sprintsUrl = () => `/api/projects/${projectId}/sprints`;

  const findTask = (id: string) =>
    dataSource.getRepository(Task).findOneBy({ id });

  const createTask = (id: string, sprintId: string, completed: boolean) =>
    dataSource.getRepository(Task).save({
      id,
      userId,
      title: id,
      projectId,
      sprintId,
      completed,
    });

  it('жизненный цикл спринта: создание, старт, завершение с переносом, удаление', async () => {
    const { body: project } = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', auth())
      .send({ title: 'Sprints e2e', viewMode: 'board', type: 'agile' })
      .expect(201);
    projectId = project.id;

    const { body: first } = (await request(app.getHttpServer())
      .post(sprintsUrl())
      .set('Authorization', auth())
      .send({})
      .expect(201)) as { body: SprintBody };
    const { body: second } = (await request(app.getHttpServer())
      .post(sprintsUrl())
      .set('Authorization', auth())
      .send({})
      .expect(201)) as { body: SprintBody };
    expect(first.name).toBe('Спринт 1');
    expect(second.name).toBe('Спринт 2');
    expect(first.status).toBe('planned');

    const dates = { startDate: '2026-01-01', endDate: '2026-01-14' };
    const { body: started } = await request(app.getHttpServer())
      .post(`${sprintsUrl()}/${first.id}/start`)
      .set('Authorization', auth())
      .send({ ...dates, goal: 'Цель' })
      .expect(201);
    expect(started.status).toBe('active');
    expect(started.goal).toBe('Цель');

    const { body: rejected } = await request(app.getHttpServer())
      .post(`${sprintsUrl()}/${second.id}/start`)
      .set('Authorization', auth())
      .send(dates)
      .expect(400);
    expect(rejected.message).toBe('Another sprint is already active');

    await createTask('task-done', first.id, true);
    await createTask('task-todo', first.id, false);

    const { body: closed } = await request(app.getHttpServer())
      .post(`${sprintsUrl()}/${first.id}/complete`)
      .set('Authorization', auth())
      .send({ moveTo: second.id })
      .expect(201);
    expect(closed.status).toBe('closed');
    expect(closed.completedAt).not.toBeNull();

    expect((await findTask('task-todo'))?.sprintId).toBe(second.id);
    expect((await findTask('task-done'))?.sprintId).toBe(first.id);

    const { body: list } = (await request(app.getHttpServer())
      .get(sprintsUrl())
      .set('Authorization', auth())
      .expect(200)) as { body: SprintBody[] };
    expect(list.map((s) => [s.id, s.status])).toEqual([
      [first.id, 'closed'],
      [second.id, 'planned'],
    ]);

    await request(app.getHttpServer())
      .delete(`${sprintsUrl()}/${second.id}`)
      .set('Authorization', auth())
      .expect(200);

    const orphan = await findTask('task-todo');
    expect(orphan).not.toBeNull();
    expect(orphan?.sprintId).toBeNull();
  });

  it('завершение отклоняет moveTo, не являющийся planned-спринтом проекта', async () => {
    const { body: sprint } = (await request(app.getHttpServer())
      .post(sprintsUrl())
      .set('Authorization', auth())
      .send({})
      .expect(201)) as { body: SprintBody };
    await request(app.getHttpServer())
      .post(`${sprintsUrl()}/${sprint.id}/start`)
      .set('Authorization', auth())
      .send({ startDate: '2026-02-01', endDate: '2026-02-14' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`${sprintsUrl()}/${sprint.id}/complete`)
      .set('Authorization', auth())
      .send({ moveTo: 'not-a-uuid' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`${sprintsUrl()}/${sprint.id}/complete`)
      .set('Authorization', auth())
      .send({ moveTo: '33333333-3333-4333-8333-333333333333' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`${sprintsUrl()}/${sprint.id}/complete`)
      .set('Authorization', auth())
      .send({})
      .expect(400);
  });

  it('PATCH закрытого спринта даёт 400', async () => {
    const { body: list } = (await request(app.getHttpServer())
      .get(sprintsUrl())
      .set('Authorization', auth())
      .expect(200)) as { body: SprintBody[] };
    const closed = list.find((s) => s.status === 'closed');

    await request(app.getHttpServer())
      .patch(`${sprintsUrl()}/${closed?.id}`)
      .set('Authorization', auth())
      .send({ name: 'Новое имя' })
      .expect(400);
  });

  describe('назначение задач в спринт через API задач', () => {
    interface TaskBody {
      id: string;
      columnId: string | null;
      sprintId: string | null;
    }
    interface ColumnBody {
      id: string;
      order: number;
    }

    const createAgileProject = async (title: string): Promise<string> => {
      const { body } = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', auth())
        .send({ title, viewMode: 'board', type: 'agile' })
        .expect(201);
      return (body as { id: string }).id;
    };

    const createSprintIn = async (project: string): Promise<SprintBody> => {
      const { body } = await request(app.getHttpServer())
        .post(`/api/projects/${project}/sprints`)
        .set('Authorization', auth())
        .send({})
        .expect(201);
      return body as SprintBody;
    };

    it('создание с sprintId без columnId проставляет первую колонку', async () => {
      const project = await createAgileProject('Assign create');
      const sprint = await createSprintIn(project);
      const { body: columns } = (await request(app.getHttpServer())
        .get(`/api/projects/${project}/columns`)
        .set('Authorization', auth())
        .expect(200)) as { body: ColumnBody[] };
      const first = [...columns].sort((a, b) => a.order - b.order)[0];

      const { body: task } = (await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', auth())
        .send({ title: 'В спринт', projectId: project, sprintId: sprint.id })
        .expect(201)) as { body: TaskBody };

      expect(task.sprintId).toBe(sprint.id);
      expect(task.columnId).toBe(first.id);
    });

    it('PATCH: закрытый спринт и спринт другого проекта дают 400, снятие сохраняет колонку', async () => {
      const project = await createAgileProject('Assign patch');
      const other = await createAgileProject('Assign other');
      const otherSprint = await createSprintIn(other);
      const target = await createSprintIn(project);
      const closing = await createSprintIn(project);

      await request(app.getHttpServer())
        .post(`/api/projects/${project}/sprints/${closing.id}/start`)
        .set('Authorization', auth())
        .send({ startDate: '2026-03-01', endDate: '2026-03-14' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/projects/${project}/sprints/${closing.id}/complete`)
        .set('Authorization', auth())
        .send({ moveTo: target.id })
        .expect(201);

      const { body: task } = (await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', auth())
        .send({ title: 'Задача', projectId: project })
        .expect(201)) as { body: TaskBody };
      const patch = (payload: Record<string, unknown>) =>
        request(app.getHttpServer())
          .patch(`/api/tasks/${task.id}`)
          .set('Authorization', auth())
          .send(payload);

      await patch({ sprintId: closing.id }).expect(400);
      await patch({ sprintId: otherSprint.id }).expect(400);

      const { body: assigned } = (await patch({ sprintId: target.id }).expect(
        200,
      )) as { body: { task: TaskBody } };
      expect(assigned.task.sprintId).toBe(target.id);
      expect(assigned.task.columnId).not.toBeNull();

      const { body: released } = (await patch({ sprintId: null }).expect(
        200,
      )) as { body: { task: TaskBody } };
      expect(released.task.sprintId).toBeNull();
      expect(released.task.columnId).toBe(assigned.task.columnId);
    });
  });
});
