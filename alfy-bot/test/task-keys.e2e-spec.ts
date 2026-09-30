import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/test-app';
import { Project } from '../src/shared/entities';

interface ProjectBody {
  id: string;
  type: string;
  taskKeyPrefix: string | null;
  nextTaskNumber: number;
}

interface TaskBody {
  id: string;
  projectId: string | null;
  number: number | null;
}

describe('Task keys (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;

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

  const postProject = (payload: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', auth())
      .send(payload);

  const patchProject = (id: string, payload: Record<string, unknown>) =>
    request(app.getHttpServer())
      .patch(`/api/projects/${id}`)
      .set('Authorization', auth())
      .send(payload);

  const createProject = async (payload: Record<string, unknown>) => {
    const { body } = await postProject(payload).expect(201);
    return body as ProjectBody;
  };

  const createTask = async (payload: Record<string, unknown>) => {
    const { body } = await request(app.getHttpServer())
      .post('/api/tasks')
      .set('Authorization', auth())
      .send(payload)
      .expect(201);
    return body as TaskBody;
  };

  it('agile-проект с префиксом нумерует задачи 1, 2; удаление не освобождает номер', async () => {
    const project = await createProject({
      title: 'Ключи',
      type: 'agile',
      taskKeyPrefix: 'KEY',
    });
    expect(project.taskKeyPrefix).toBe('KEY');
    expect(project.nextTaskNumber).toBe(1);

    const first = await createTask({ title: 'Первая', projectId: project.id });
    const second = await createTask({ title: 'Вторая', projectId: project.id });
    expect(first.number).toBe(1);
    expect(second.number).toBe(2);

    await request(app.getHttpServer())
      .delete(`/api/tasks/${second.id}`)
      .set('Authorization', auth())
      .expect(200);
    const third = await createTask({ title: 'Третья', projectId: project.id });
    expect(third.number).toBe(3);
  });

  it('задачи обычного проекта и Входящих без номера', async () => {
    const simple = await createProject({ title: 'Обычный' });

    expect(
      (await createTask({ title: 'В проекте', projectId: simple.id })).number,
    ).toBeNull();
    expect((await createTask({ title: 'Во входящих' })).number).toBeNull();
  });

  it('дубликат префикса пользователя — 400', async () => {
    await createProject({ title: 'A', type: 'agile', taskKeyPrefix: 'DUP' });

    const { body } = await postProject({
      title: 'B',
      type: 'agile',
      taskKeyPrefix: 'DUP',
    }).expect(400);
    expect((body as { message: string }).message).toBe(
      'Task key prefix is already used',
    );

    const other = await createProject({ title: 'C', type: 'agile' });
    await patchProject(other.id, { taskKeyPrefix: 'DUP' }).expect(400);
  });

  it('префикс у обычного проекта — 400', async () => {
    const { body } = await postProject({
      title: 'Обычный',
      taskKeyPrefix: 'SMP',
    }).expect(400);
    expect((body as { message: string }).message).toBe(
      'Task key prefix is only for agile projects',
    );

    const simple = await createProject({ title: 'Обычный 2' });
    await patchProject(simple.id, { taskKeyPrefix: 'SMP' }).expect(400);
  });

  it.each(['a', 'ab', 'A', '1AB', 'AB-C', 'ABCDEFGHIJK', ''])(
    'префикс неверного формата %p — 400',
    async (taskKeyPrefix) => {
      await postProject({
        title: 'Формат',
        type: 'agile',
        taskKeyPrefix,
      }).expect(400);
    },
  );

  it('префикс можно изменить и очистить, повторная установка своего — 200', async () => {
    const project = await createProject({
      title: 'Смена',
      type: 'agile',
      taskKeyPrefix: 'CHG',
    });

    await patchProject(project.id, { taskKeyPrefix: 'CHG' }).expect(200);
    const { body: changed } = await patchProject(project.id, {
      taskKeyPrefix: 'NEW',
    }).expect(200);
    expect((changed as ProjectBody).taskKeyPrefix).toBe('NEW');

    const { body: cleared } = await patchProject(project.id, {
      taskKeyPrefix: null,
    }).expect(200);
    expect((cleared as ProjectBody).taskKeyPrefix).toBeNull();

    await createProject({
      title: 'Занимает',
      type: 'agile',
      taskKeyPrefix: 'CHG',
    });
  });

  it('nextTaskNumber нельзя задать через API', async () => {
    const project = await createProject({
      title: 'Счётчик',
      type: 'agile',
      nextTaskNumber: 500,
    });
    expect(project.nextTaskNumber).toBe(1);

    await patchProject(project.id, { nextTaskNumber: 900 }).expect(200);
    const stored = await dataSource
      .getRepository(Project)
      .findOneByOrFail({ id: project.id });
    expect(stored.nextTaskNumber).toBe(1);
  });

  it('переезд задачи между agile-проектами выдаёт номер в целевом проекте', async () => {
    const source = await createProject({ title: 'Источник', type: 'agile' });
    const target = await createProject({ title: 'Цель', type: 'agile' });
    await createTask({ title: 'Занимает 1', projectId: target.id });
    const moved = await createTask({ title: 'Едет', projectId: source.id });
    expect(moved.number).toBe(1);

    const { body } = await request(app.getHttpServer())
      .patch(`/api/tasks/${moved.id}`)
      .set('Authorization', auth())
      .send({ projectId: target.id })
      .expect(200);
    expect((body as { task: TaskBody }).task.number).toBe(2);

    const { body: viaBoard } = await request(app.getHttpServer())
      .patch(`/api/projects/${source.id}/tasks/${moved.id}/move`)
      .set('Authorization', auth())
      .send({ projectId: source.id, order: 0 })
      .expect(200);
    expect((viaBoard as TaskBody).projectId).toBe(source.id);
    expect((viaBoard as TaskBody).number).toBe(2);
  });
});
