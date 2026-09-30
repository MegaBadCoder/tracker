import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/test-app';
import { Task } from '../src/shared/entities';

interface ReleaseBody {
  id: string;
  name: string;
  status: string;
  releasedAt: string | null;
  order: number;
}

interface TaskBody {
  id: string;
  releaseId: string | null;
}

describe('Releases (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let projectId: string;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    token = ctx.token;
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close().catch(() => {});
  });

  const auth = () => `Bearer ${token}`;
  const releasesUrl = (project = projectId) =>
    `/api/projects/${project}/releases`;

  const findTask = (id: string) =>
    dataSource.getRepository(Task).findOneBy({ id });

  const createAgileProject = async (title: string): Promise<string> => {
    const { body } = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', auth())
      .send({ title, viewMode: 'board', type: 'agile' })
      .expect(201);
    return (body as { id: string }).id;
  };

  const createRelease = async (
    name: string,
    project = projectId,
  ): Promise<ReleaseBody> => {
    const { body } = await request(app.getHttpServer())
      .post(releasesUrl(project))
      .set('Authorization', auth())
      .send({ name })
      .expect(201);
    return body as ReleaseBody;
  };

  const createTaskApi = async (
    payload: Record<string, unknown>,
  ): Promise<TaskBody> => {
    const { body } = await request(app.getHttpServer())
      .post('/api/tasks')
      .set('Authorization', auth())
      .send(payload)
      .expect(201);
    return body as TaskBody;
  };

  const createGroup = async (
    title: string,
    parentId?: string,
  ): Promise<string> => {
    const { body } = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/groups`)
      .set('Authorization', auth())
      .send({ title, parentId })
      .expect(201);
    return (body as { id: string }).id;
  };

  it('жизненный цикл релиза: создание, назначение задач, выпуск с переносом, отказ в назначении, удаление', async () => {
    projectId = await createAgileProject('Releases e2e');

    const first = await createRelease('Релиз 1');
    const second = await createRelease('Релиз 2');
    expect(first.status).toBe('planned');
    expect(first.order).toBe(0);
    expect(second.order).toBe(1);

    const epicId = await createGroup('Эпик');
    const storyId = await createGroup('История', epicId);

    const viaApi = await createTaskApi({
      title: 'Через API задач',
      projectId,
      releaseId: first.id,
    });
    expect(viaApi.releaseId).toBe(first.id);

    const inEpic = await createTaskApi({
      title: 'В эпике',
      projectId,
      groupId: epicId,
    });
    const inStory = await createTaskApi({
      title: 'В истории',
      projectId,
      groupId: storyId,
    });
    const outside = await createTaskApi({ title: 'Вне эпика', projectId });

    const { body: assigned } = await request(app.getHttpServer())
      .post(`${releasesUrl()}/${first.id}/assign-group`)
      .set('Authorization', auth())
      .send({ groupId: epicId })
      .expect(201);
    expect(assigned).toEqual({ updated: 2 });
    expect((await findTask(inEpic.id))?.releaseId).toBe(first.id);
    expect((await findTask(inStory.id))?.releaseId).toBe(first.id);
    expect((await findTask(outside.id))?.releaseId).toBeNull();

    await dataSource
      .getRepository(Task)
      .update({ id: viaApi.id }, { completed: true });

    const { body: released } = (await request(app.getHttpServer())
      .post(`${releasesUrl()}/${first.id}/release`)
      .set('Authorization', auth())
      .send({ moveTo: second.id })
      .expect(201)) as { body: ReleaseBody };
    expect(released.status).toBe('released');
    expect(released.releasedAt).not.toBeNull();

    expect((await findTask(viaApi.id))?.releaseId).toBe(first.id);
    expect((await findTask(inEpic.id))?.releaseId).toBe(second.id);
    expect((await findTask(inStory.id))?.releaseId).toBe(second.id);

    await request(app.getHttpServer())
      .patch(`/api/tasks/${outside.id}`)
      .set('Authorization', auth())
      .send({ releaseId: first.id })
      .expect(400);
    await request(app.getHttpServer())
      .post(`${releasesUrl()}/${first.id}/assign-group`)
      .set('Authorization', auth())
      .send({ groupId: epicId })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`${releasesUrl()}/${first.id}`)
      .set('Authorization', auth())
      .send({ name: 'Новое имя' })
      .expect(400);

    const { body: list } = (await request(app.getHttpServer())
      .get(releasesUrl())
      .set('Authorization', auth())
      .expect(200)) as { body: ReleaseBody[] };
    expect(list.map((r) => [r.id, r.status])).toEqual([
      [first.id, 'released'],
      [second.id, 'planned'],
    ]);

    await request(app.getHttpServer())
      .delete(`${releasesUrl()}/${second.id}`)
      .set('Authorization', auth())
      .expect(200);

    const orphan = await findTask(inEpic.id);
    expect(orphan).not.toBeNull();
    expect(orphan?.releaseId).toBeNull();
  });

  it('выпуск с moveTo: none снимает релиз с незавершённых задач', async () => {
    const release = await createRelease('Без переноса');
    const todo = await createTaskApi({
      title: 'Незавершённая',
      projectId,
      releaseId: release.id,
    });

    await request(app.getHttpServer())
      .post(`${releasesUrl()}/${release.id}/release`)
      .set('Authorization', auth())
      .send({ moveTo: 'none' })
      .expect(201);

    expect((await findTask(todo.id))?.releaseId).toBeNull();
  });

  it('выпуск отклоняет некорректный moveTo', async () => {
    const release = await createRelease('Некорректный moveTo');
    const post = (body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post(`${releasesUrl()}/${release.id}/release`)
        .set('Authorization', auth())
        .send(body);

    await post({ moveTo: 'not-a-uuid' }).expect(400);
    await post({ moveTo: '33333333-3333-4333-8333-333333333333' }).expect(400);
    await post({ moveTo: release.id }).expect(400);
    await post({}).expect(400);
  });

  it('релиз другого проекта не назначается задаче', async () => {
    const other = await createAgileProject('Releases other');
    const foreign = await createRelease('Чужой', other);
    const task = await createTaskApi({ title: 'Задача', projectId });

    await request(app.getHttpServer())
      .patch(`/api/tasks/${task.id}`)
      .set('Authorization', auth())
      .send({ releaseId: foreign.id })
      .expect(400);
  });

  it('создание без имени и PATCH с name: null дают 400', async () => {
    await request(app.getHttpServer())
      .post(releasesUrl())
      .set('Authorization', auth())
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post(releasesUrl())
      .set('Authorization', auth())
      .send({ name: '' })
      .expect(400);

    const release = await createRelease('Для PATCH');
    await request(app.getHttpServer())
      .patch(`${releasesUrl()}/${release.id}`)
      .set('Authorization', auth())
      .send({ name: null })
      .expect(400);
  });

  it('даты: startDate позже releaseDate даёт 400', async () => {
    await request(app.getHttpServer())
      .post(releasesUrl())
      .set('Authorization', auth())
      .send({
        name: 'Даты',
        startDate: '2026-02-01',
        releaseDate: '2026-01-01',
      })
      .expect(400);
  });
});
