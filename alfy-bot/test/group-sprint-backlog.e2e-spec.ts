import request from 'supertest';
import { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/test-app';
import {
  BoardGroup,
  ProjectColumn,
  Release,
  Sprint,
  Task,
  User,
} from '../src/shared/entities';
import { ApiTokenService } from '../src/modules/auth/application/api-token.service';

describe('Group sprint backlog (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let db: DataSource;
  let token: string;
  let userId: number;

  beforeAll(async () => {
    const context = await createTestApp();
    app = context.app;
    server = app.getHttpServer() as Server;
    userId = context.userId;
    db = app.get(DataSource);
    token = (await app.get(ApiTokenService).generate(userId, 'group-backlog'))
      .plaintext;
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const url = (projectId: string, sprintId: string, groupId: string) =>
    `/api/projects/${projectId}/sprints/${sprintId}/groups/${groupId}/backlog`;

  async function fixture(type: 'agile' | 'simple' = 'agile') {
    const project = await request(server)
      .post('/api/projects')
      .set(auth())
      .send({ title: 'Backlog test', viewMode: 'board', type })
      .expect(201);
    const projectId = (project.body as { id: string }).id;
    const groups = db.getRepository(BoardGroup);
    const epic = await groups.save({
      projectId,
      userId,
      type: 'epic',
      title: 'Epic',
    });
    const sibling = await groups.save({
      projectId,
      userId,
      type: 'epic',
      title: 'Other',
    });
    const sprints = db.getRepository(Sprint);
    const source = await sprints.save({
      projectId,
      userId,
      name: 'Source',
      status: 'active',
    });
    const planned = await sprints.save({
      projectId,
      userId,
      name: 'Planned',
      status: 'planned',
    });
    const closed = await sprints.save({
      projectId,
      userId,
      name: 'Closed',
      status: 'closed',
    });
    const story = await groups.save({
      projectId,
      userId,
      type: 'story',
      parentId: epic.id,
      title: 'Story',
      sprintId: source.id,
    });
    const otherStory = await groups.save({
      projectId,
      userId,
      type: 'story',
      parentId: epic.id,
      title: 'Other story',
      sprintId: planned.id,
    });
    const empty = await groups.save({
      projectId,
      userId,
      type: 'story',
      parentId: epic.id,
      title: 'Empty',
      sprintId: source.id,
    });
    const column = await db
      .getRepository(ProjectColumn)
      .save({ projectId, title: 'Todo', order: 10 });
    const release = await db
      .getRepository(Release)
      .save({ projectId, userId, name: 'Release' });
    await groups.update(story.id, { releaseId: release.id, status: 'done' });
    const tasks = await db.getRepository(Task).save(
      [
        { title: 'Direct', groupId: epic.id, sprintId: source.id },
        {
          title: 'Done story',
          groupId: story.id,
          sprintId: source.id,
          completed: true,
        },
        {
          title: 'Other assignment',
          groupId: otherStory.id,
          sprintId: source.id,
        },
        { title: 'Planned', groupId: story.id, sprintId: planned.id },
        { title: 'Closed', groupId: story.id, sprintId: closed.id },
        { title: 'Backlog', groupId: story.id, sprintId: null },
        { title: 'Sibling', groupId: sibling.id, sprintId: source.id },
      ].map((task) => ({
        ...task,
        projectId,
        userId,
        columnId: column.id,
        releaseId: release.id,
      })),
    );
    return {
      projectId,
      source,
      planned,
      closed,
      epic,
      story,
      otherStory,
      empty,
      tasks: await Promise.all(
        tasks.map((task) =>
          db.getRepository(Task).findOneByOrFail({ id: task.id }),
        ),
      ),
    };
  }

  it('возвращает эпик и пустые истории, сохраняя остальные поля и другие спринты; повтор идемпотентен', async () => {
    const f = await fixture();
    const beforeGroups = await db
      .getRepository(BoardGroup)
      .findBy({ projectId: f.projectId });
    const response = await request(server)
      .post(url(f.projectId, f.source.id, f.epic.id))
      .set(auth())
      .expect(201);
    expect(response.body).toEqual({ updated: 3 });
    for (let i = 0; i < f.tasks.length; i++) {
      const task = await db
        .getRepository(Task)
        .findOneByOrFail({ id: f.tasks[i].id });
      expect(task).toEqual({
        ...f.tasks[i],
        sprintId: i < 3 ? null : f.tasks[i].sprintId,
        updatedAt: expect.any(Date) as Date,
      });
    }
    for (const group of beforeGroups) {
      const after = await db
        .getRepository(BoardGroup)
        .findOneByOrFail({ id: group.id });
      expect(after).toEqual({
        ...group,
        sprintId: group.sprintId === f.source.id ? null : group.sprintId,
        updatedAt: expect.any(Date) as Date,
      });
    }
    await request(server)
      .post(url(f.projectId, f.source.id, f.epic.id))
      .set(auth())
      .expect(201, { updated: 0 });
  });

  it('возвращает только выбранную историю из planned-спринта и сохраняет назначение другого спринта', async () => {
    const f = await fixture();
    await request(server)
      .post(url(f.projectId, f.planned.id, f.story.id))
      .set(auth())
      .expect(201, { updated: 1 });
    expect(
      (await db.getRepository(BoardGroup).findOneByOrFail({ id: f.story.id }))
        .sprintId,
    ).toBe(f.source.id);
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: f.tasks[1].id }))
        .sprintId,
    ).toBe(f.source.id);
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: f.tasks[3].id }))
        .sprintId,
    ).toBeNull();
  });

  it('отклоняет закрытый спринт, чужие группы/спринты, простой проект и неавторизованный запрос', async () => {
    const f = await fixture();
    const other = await fixture();
    const simple = await fixture('simple');
    const foreignUser = await db
      .getRepository(User)
      .save({ telegramId: 991122, username: 'foreign-backlog' });
    const foreignToken = (
      await app.get(ApiTokenService).generate(foreignUser.id, 'foreign')
    ).plaintext;
    await request(server)
      .post(url(f.projectId, f.source.id, f.epic.id))
      .set({ Authorization: `Bearer ${foreignToken}` })
      .expect(404);

    await request(server)
      .post(url(f.projectId, f.closed.id, f.epic.id))
      .set(auth())
      .expect(400);
    await request(server)
      .post(url(f.projectId, f.source.id, other.epic.id))
      .set(auth())
      .expect(404);
    await request(server)
      .post(url(f.projectId, other.source.id, f.epic.id))
      .set(auth())
      .expect(404);
    await request(server)
      .post(url(simple.projectId, simple.source.id, simple.epic.id))
      .set(auth())
      .expect(400);
    await request(server)
      .post(url(f.projectId, f.source.id, f.epic.id))
      .expect(401);
    expect(
      await db.getRepository(Task).findBy({ projectId: f.projectId }),
    ).toEqual(expect.arrayContaining(f.tasks));
  });

  it('ошибка записи задачи откатывает перенос всех групп и задач', async () => {
    const f = await fixture();
    await db.query(
      `CREATE TRIGGER fail_backlog BEFORE UPDATE OF sprintId ON tasks WHEN OLD.id = '${f.tasks[1].id}' AND NEW.sprintId IS NULL BEGIN SELECT RAISE(ABORT, 'forced rollback'); END`,
    );
    try {
      await request(server)
        .post(url(f.projectId, f.source.id, f.epic.id))
        .set(auth())
        .expect(500);
      expect(
        await db.getRepository(Task).findBy({ projectId: f.projectId }),
      ).toEqual(expect.arrayContaining(f.tasks));
      expect(
        (await db.getRepository(BoardGroup).findOneByOrFail({ id: f.story.id }))
          .sprintId,
      ).toBe(f.source.id);
      expect(
        (await db.getRepository(BoardGroup).findOneByOrFail({ id: f.empty.id }))
          .sprintId,
      ).toBe(f.source.id);
    } finally {
      await db.query('DROP TRIGGER fail_backlog');
    }
  });
});
