import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/test-app';

describe('Жизненный цикл историй (HTTP + SQLite)', () => {
  let app: INestApplication;
  let token: string;
  let projectId: string;
  let epicId: string;
  let storyId: string;

  const api = () => request(app.getHttpServer());
  const auth = () => `Bearer ${token}`;
  const groups = () => `/api/projects/${projectId}/groups`;
  const workflow = () => `/api/projects/${projectId}/story-workflow`;

  beforeAll(async () => {
    ({ app, token } = await createTestApp());
    await app.listen(0, '127.0.0.1');
    const project = await api()
      .post('/api/projects')
      .set('Authorization', auth())
      .send({ title: 'Истории', type: 'agile', viewMode: 'board' })
      .expect(201);
    projectId = project.body.id as string;
    const epic = await api()
      .post(groups())
      .set('Authorization', auth())
      .send({ title: 'Эпик' })
      .expect(201);
    epicId = epic.body.id as string;
    const story = await api()
      .post(groups())
      .set('Authorization', auth())
      .send({ title: 'Оплата', parentId: epicId })
      .expect(201);
    storyId = story.body.id as string;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('возвращает пять серверных статусов с русскими названиями', async () => {
    const response = await api()
      .get(workflow())
      .set('Authorization', auth())
      .expect(200);
    expect(response.body.statuses.map((s: { id: string }) => s.id)).toEqual([
      'open',
      'ready',
      'in_progress',
      'review',
      'done',
    ]);
    expect(response.body.statuses[2].name).toBe('В работе');
  });

  it('меняет статус без завершения задач и сохраняет его после переноса в спринт', async () => {
    await api()
      .patch(`${groups()}/${storyId}`)
      .set('Authorization', auth())
      .send({
        workflowStatusId: 'in_progress',
        blockedReason: 'Ждём ответ',
        deferredUntil: '2026-11-20',
      })
      .expect(200);
    const sprint = await api()
      .post(`/api/projects/${projectId}/sprints`)
      .set('Authorization', auth())
      .send({})
      .expect(201);
    await api()
      .patch(`${groups()}/${storyId}/sprint`)
      .set('Authorization', auth())
      .send({ sprintId: sprint.body.id })
      .expect(200);
    const tree = await api()
      .get(groups())
      .set('Authorization', auth())
      .expect(200);
    expect(tree.body[0].children[0]).toMatchObject({
      status: 'open',
      workflowStatusId: 'in_progress',
      blockedReason: 'Ждём ответ',
      deferredUntil: '2026-11-20',
    });
  });

  it('поддерживает старое завершение и повторное открытие', async () => {
    const done = await api()
      .patch(`${groups()}/${storyId}`)
      .set('Authorization', auth())
      .send({ status: 'done' })
      .expect(200);
    expect(done.body).toMatchObject({
      status: 'done',
      workflowStatusId: 'done',
    });
    expect(done.body.completedAt).not.toBeNull();
    const reopened = await api()
      .patch(`${groups()}/${storyId}`)
      .set('Authorization', auth())
      .send({ status: 'open' })
      .expect(200);
    expect(reopened.body).toMatchObject({
      status: 'open',
      workflowStatusId: 'open',
      completedAt: null,
    });
  });

  it('позволяет переименовать каталог, добавить промежуточный статус и применить его', async () => {
    const response = await api()
      .get(workflow())
      .set('Authorization', auth())
      .expect(200);
    const statuses = [
      ...response.body.statuses,
      {
        id: 'qa',
        name: 'Проверка на стенде',
        category: 'review',
        color: '#a855f7',
      },
    ];
    statuses[0].name = 'Идея';
    await api()
      .put(workflow())
      .set('Authorization', auth())
      .send({ statuses })
      .expect(200);
    const updated = await api()
      .patch(`${groups()}/${storyId}`)
      .set('Authorization', auth())
      .send({ workflowStatusId: 'qa' })
      .expect(200);
    expect(updated.body).toMatchObject({
      workflowStatusId: 'qa',
      status: 'open',
    });
    const reread = await api()
      .get(workflow())
      .set('Authorization', auth())
      .expect(200);
    expect(reread.body.statuses[0].name).toBe('Идея');
  });

  it('не удаляет занятый статус и не меняет категорию занятого статуса', async () => {
    const { body } = await api()
      .get(workflow())
      .set('Authorization', auth())
      .expect(200);
    await api()
      .put(workflow())
      .set('Authorization', auth())
      .send({
        statuses: body.statuses.filter((s: { id: string }) => s.id !== 'qa'),
      })
      .expect(400);
    await api()
      .put(workflow())
      .set('Authorization', auth())
      .send({
        statuses: body.statuses.map((s: { id: string }) =>
          s.id === 'qa' ? { ...s, category: 'done' } : s,
        ),
      })
      .expect(400);
  });

  it('сохраняет архив и позволяет восстановить историю', async () => {
    const archived = await api()
      .patch(`${groups()}/${storyId}`)
      .set('Authorization', auth())
      .send({ archived: true })
      .expect(200);
    expect(archived.body.archived).toBe(true);
    const restored = await api()
      .patch(`${groups()}/${storyId}`)
      .set('Authorization', auth())
      .send({ archived: false, blockedReason: null, deferredUntil: null })
      .expect(200);
    expect(restored.body).toMatchObject({
      archived: false,
      blockedReason: null,
      deferredUntil: null,
    });
  });

  it('отклоняет чужие зависимости, эпики, самоссылки и циклы', async () => {
    for (const dependencyIds of [
      [storyId],
      [epicId],
      [randomUUID()],
      [storyId, storyId],
    ]) {
      await api()
        .patch(`${groups()}/${storyId}`)
        .set('Authorization', auth())
        .send({ dependencyIds })
        .expect(400);
    }
    const second = await api()
      .post(groups())
      .set('Authorization', auth())
      .send({ title: 'Вторая', parentId: epicId })
      .expect(201);
    const secondId = second.body.id as string;
    await api()
      .patch(`${groups()}/${storyId}`)
      .set('Authorization', auth())
      .send({ dependencyIds: [secondId] })
      .expect(200);
    await api()
      .patch(`${groups()}/${secondId}`)
      .set('Authorization', auth())
      .send({ dependencyIds: [storyId] })
      .expect(400);
  });

  it.each([
    { workflowStatusId: 'missing' },
    { workflowStatusId: null },
    { archived: null },
    { dependencyIds: null },
    { deferredUntil: '2026-02-30' },
    { blockedReason: '   ' },
    { workflowStatusId: 'review', status: 'done' },
  ])('отклоняет невалидные поля %j', async (payload) => {
    await api()
      .patch(`${groups()}/${storyId}`)
      .set('Authorization', auth())
      .send(payload)
      .expect(400);
  });

  it('не раскрывает каталог чужого проекта', async () => {
    await api()
      .get(`/api/projects/${randomUUID()}/story-workflow`)
      .set('Authorization', auth())
      .expect(404);
  });
  it('конкурентные зависимости не образуют цикл', async () => {
    const first = await api()
      .post(groups())
      .set('Authorization', auth())
      .send({ title: 'А', parentId: epicId })
      .expect(201);
    const second = await api()
      .post(groups())
      .set('Authorization', auth())
      .send({ title: 'Б', parentId: epicId })
      .expect(201);
    const results = await Promise.all([
      api()
        .patch(`${groups()}/${first.body.id}`)
        .set('Authorization', auth())
        .send({ dependencyIds: [second.body.id] }),
      api()
        .patch(`${groups()}/${second.body.id}`)
        .set('Authorization', auth())
        .send({ dependencyIds: [first.body.id] }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
  });

  it('удаление статуса одновременно с назначением не оставляет неизвестный статус', async () => {
    const original = await api()
      .get(workflow())
      .set('Authorization', auth())
      .expect(200);
    const statuses = [
      ...original.body.statuses,
      { id: 'race', name: 'Проверка', category: 'review', color: '#9333ea' },
    ];
    await api()
      .put(workflow())
      .set('Authorization', auth())
      .send({ statuses })
      .expect(200);
    const results = await Promise.all([
      api()
        .patch(`${groups()}/${storyId}`)
        .set('Authorization', auth())
        .send({ workflowStatusId: 'race' }),
      api()
        .put(workflow())
        .set('Authorization', auth())
        .send({ statuses: original.body.statuses }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
    const tree = await api()
      .get(groups())
      .set('Authorization', auth())
      .expect(200);
    const catalog = await api()
      .get(workflow())
      .set('Authorization', auth())
      .expect(200);
    const story = tree.body[0].children.find(
      (item: { id: string }) => item.id === storyId,
    );
    expect(
      catalog.body.statuses.map((status: { id: string }) => status.id),
    ).toContain(story.workflowStatusId);
  });

  it('выполнение всех задач не принимает результат истории автоматически', async () => {
    const story = await api()
      .post(groups())
      .set('Authorization', auth())
      .send({ title: 'Проверка результата', parentId: epicId })
      .expect(201);
    await api()
      .patch(`${groups()}/${story.body.id}`)
      .set('Authorization', auth())
      .send({ workflowStatusId: 'review' })
      .expect(200);
    const task = await api()
      .post('/api/tasks')
      .set('Authorization', auth())
      .send({
        title: 'Реализация',
        projectId,
        groupId: story.body.id,
        sprintId: null,
      })
      .expect(201);
    await api()
      .patch(`/api/tasks/${task.body.id}`)
      .set('Authorization', auth())
      .send({ completed: true })
      .expect(200);
    const tree = await api()
      .get(groups())
      .set('Authorization', auth())
      .expect(200);
    expect(
      tree.body[0].children.find(
        (item: { id: string }) => item.id === story.body.id,
      ),
    ).toMatchObject({
      workflowStatusId: 'review',
      status: 'open',
      completedAt: null,
    });
  });

  it('повторное завершение не меняет дату принятия результата', async () => {
    const first = await api()
      .patch(`${groups()}/${storyId}`)
      .set('Authorization', auth())
      .send({ status: 'done' })
      .expect(200);
    const second = await api()
      .patch(`${groups()}/${storyId}`)
      .set('Authorization', auth())
      .send({ status: 'done' })
      .expect(200);
    expect(second.body.completedAt).toBe(first.body.completedAt);
  });

  it.each(
    [
      null,
      [],
      [null],
      ['bad'],
      [{ id: 'one', name: 'Один', category: 'unknown', color: 'red' }],
    ].map((statuses) => ({ statuses })),
  )('невалидный каталог $statuses возвращает 400', async ({ statuses }) => {
    await api()
      .put(workflow())
      .set('Authorization', auth())
      .send({ statuses })
      .expect(400);
  });
});
