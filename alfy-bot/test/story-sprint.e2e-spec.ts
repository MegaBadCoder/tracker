import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/test-app';
import { BoardGroup, Task, User } from '../src/shared/entities';

describe('Story sprint (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let otherToken: string;

  beforeAll(async () => {
    const context = await createTestApp();
    app = context.app;
    token = context.token;
    dataSource = app.get(DataSource);
    const other = await dataSource
      .getRepository(User)
      .save({ telegramId: 998, username: 'other' });
    otherToken = app.get(JwtService).sign({ telegramId: 998, sub: other.id });
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = (value = token) => ({ Authorization: `Bearer ${value}` });

  async function createProject(type: 'agile' | 'simple' = 'agile') {
    const response = await request(app.getHttpServer())
      .post('/api/projects')
      .set(auth())
      .send({ title: 'Story sprint', viewMode: 'board', type })
      .expect(201);
    return response.body.id as string;
  }

  async function createGroup(projectId: string, parentId?: string) {
    const response = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/groups`)
      .set(auth())
      .send({
        title: parentId ? 'Story' : 'Epic',
        ...(parentId ? { parentId } : {}),
      })
      .expect(201);
    return response.body.id as string;
  }

  async function createSprint(projectId: string) {
    const response = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/sprints`)
      .set(auth())
      .send({})
      .expect(201);
    return response.body.id as string;
  }

  const groupUrl = (projectId: string, groupId: string) =>
    `/api/projects/${projectId}/groups/${groupId}/sprint`;

  it('переносит пустую историю и сохраняет назначение в дереве', async () => {
    const projectId = await createProject();
    const epicId = await createGroup(projectId);
    const storyId = await createGroup(projectId, epicId);
    const sprintId = await createSprint(projectId);

    const response = await request(app.getHttpServer())
      .patch(groupUrl(projectId, storyId))
      .set(auth())
      .send({ sprintId })
      .expect(200);
    expect(response.body).toEqual({ updated: 0 });

    const tree = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/groups`)
      .set(auth())
      .expect(200);
    expect(tree.body[0].children[0].sprintId).toBe(sprintId);
  });

  it('отвергает назначение истории простого проекта', async () => {
    const projectId = await createProject('simple');
    const epicId = await createGroup(projectId);
    const storyId = await createGroup(projectId, epicId);

    await request(app.getHttpServer())
      .patch(groupUrl(projectId, storyId))
      .set(auth())
      .send({ sprintId: null })
      .expect(400);
  });

  it('отвергает неверное тело, эпик, чужой проект и закрытый спринт', async () => {
    const projectId = await createProject();
    const epicId = await createGroup(projectId);
    const storyId = await createGroup(projectId, epicId);
    const sprintId = await createSprint(projectId);
    const url = groupUrl(projectId, storyId);

    await request(app.getHttpServer())
      .patch(url)
      .set(auth())
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .patch(url)
      .set(auth())
      .send({ sprintId: 'bad' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(groupUrl(projectId, epicId))
      .set(auth())
      .send({ sprintId })
      .expect(400);
    await request(app.getHttpServer())
      .patch(url)
      .set(auth(otherToken))
      .send({ sprintId })
      .expect(404);

    const otherProject = await createProject();
    const otherSprint = await createSprint(otherProject);
    await request(app.getHttpServer())
      .patch(url)
      .set(auth())
      .send({ sprintId: otherSprint })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/sprints/${sprintId}/start`)
      .set(auth())
      .send({ startDate: '2026-01-01', endDate: '2026-01-14' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/sprints/${sprintId}/complete`)
      .set(auth())
      .send({ moveTo: 'backlog' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(url)
      .set(auth())
      .send({ sprintId })
      .expect(400);
  });

  it('завершение переносит открытые истории и удаление очищает их FK', async () => {
    const projectId = await createProject();
    const epicId = await createGroup(projectId);
    const openStory = await createGroup(projectId, epicId);
    const doneStory = await createGroup(projectId, epicId);
    const current = await createSprint(projectId);
    const next = await createSprint(projectId);

    for (const storyId of [openStory, doneStory]) {
      await request(app.getHttpServer())
        .patch(groupUrl(projectId, storyId))
        .set(auth())
        .send({ sprintId: current })
        .expect(200);
    }
    await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/groups/${doneStory}`)
      .set(auth())
      .send({ status: 'done' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/sprints/${current}/start`)
      .set(auth())
      .send({ startDate: '2026-02-01', endDate: '2026-02-14' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/sprints/${current}/complete`)
      .set(auth())
      .send({ moveTo: next })
      .expect(201);

    const groups = dataSource.getRepository(BoardGroup);
    expect((await groups.findOneByOrFail({ id: openStory })).sprintId).toBe(
      next,
    );
    expect((await groups.findOneByOrFail({ id: doneStory })).sprintId).toBe(
      current,
    );

    await request(app.getHttpServer())
      .delete(`/api/projects/${projectId}/sprints/${current}`)
      .set(auth())
      .expect(200);
    expect(
      (await groups.findOneByOrFail({ id: doneStory })).sprintId,
    ).toBeNull();
  });

  it('переназначает историю закрытого спринта без изменения его задач', async () => {
    const projectId = await createProject();
    const epicId = await createGroup(projectId);
    const storyId = await createGroup(projectId, epicId);
    const current = await createSprint(projectId);
    const next = await createSprint(projectId);
    await request(app.getHttpServer())
      .patch(groupUrl(projectId, storyId))
      .set(auth())
      .send({ sprintId: current })
      .expect(200);
    const created = await request(app.getHttpServer())
      .post('/api/tasks')
      .set(auth())
      .send({ title: 'Done', projectId, groupId: storyId })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/tasks/${created.body.id}`)
      .set(auth())
      .send({ completed: true })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/groups/${storyId}`)
      .set(auth())
      .send({ status: 'done' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/sprints/${current}/start`)
      .set(auth())
      .send({ startDate: '2026-03-01', endDate: '2026-03-14' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/sprints/${current}/complete`)
      .set(auth())
      .send({ moveTo: next })
      .expect(201);
    await request(app.getHttpServer())
      .patch(groupUrl(projectId, storyId))
      .set(auth())
      .send({ sprintId: null })
      .expect(200);

    expect(
      (
        await dataSource
          .getRepository(BoardGroup)
          .findOneByOrFail({ id: storyId })
      ).sprintId,
    ).toBeNull();
    expect(
      (
        await dataSource
          .getRepository(Task)
          .findOneByOrFail({ id: created.body.id })
      ).sprintId,
    ).toBe(current);
  });

  it('переносит скрытую задачу истории и позволяет явный null при создании', async () => {
    const projectId = await createProject();
    const epicId = await createGroup(projectId);
    const storyId = await createGroup(projectId, epicId);
    const sprintId = await createSprint(projectId);
    const created = await request(app.getHttpServer())
      .post('/api/tasks')
      .set(auth())
      .send({
        title: 'Hidden by filters',
        projectId,
        groupId: storyId,
        completed: true,
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(groupUrl(projectId, storyId))
      .set(auth())
      .send({ sprintId })
      .expect(200);
    expect(
      (
        await dataSource
          .getRepository(Task)
          .findOneByOrFail({ id: created.body.id })
      ).sprintId,
    ).toBe(sprintId);

    const inherited = await request(app.getHttpServer())
      .post('/api/tasks')
      .set(auth())
      .send({ title: 'Inherited', projectId, groupId: storyId })
      .expect(201);
    expect(inherited.body.sprintId).toBe(sprintId);
    expect(inherited.body.columnId).not.toBeNull();

    const explicit = await request(app.getHttpServer())
      .post('/api/tasks')
      .set(auth())
      .send({ title: 'Backlog', projectId, groupId: storyId, sprintId: null })
      .expect(201);
    expect(explicit.body.sprintId).toBeNull();
  });
});
