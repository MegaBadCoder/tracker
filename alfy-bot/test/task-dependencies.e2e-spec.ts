import type { Server } from 'node:http';
import type { TaskDependencyEdge } from '../src/modules/task/domain/task-dependency';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/test-app';
import { Task, User } from '../src/shared/entities';
import { ApiTokenService } from '../src/modules/auth/application/api-token.service';
import { initializeWithSchemaSync } from '../src/shared/database/create-data-source';

describe('Task dependencies (e2e)', () => {
  let app: INestApplication;
  let source: DataSource;
  let token: string;
  let otherToken: string;
  let apiToken: string;

  beforeAll(async () => {
    const context = await createTestApp();
    app = context.app;
    token = context.token;
    source = app.get(DataSource);
    apiToken = (
      await app.get(ApiTokenService).generate(context.userId, 'dependencies')
    ).plaintext;
    const other = await source.getRepository(User).save({ username: 'other' });
    otherToken = app.get(JwtService).sign({ telegramId: 998, sub: other.id });
  });

  afterAll(async () => {
    await app?.close();
  });

  const auth = (value: string) => ({ Authorization: `Bearer ${value}` });
  const replace = (id: string, dependencyIds: string[], bearer = token) =>
    request(app.getHttpServer() as Server)
      .put(`/api/tasks/${id}/dependencies`)
      .set(auth(bearer))
      .send({ dependencyIds });
  const graph = (bearer = token) =>
    request(app.getHttpServer() as Server)
      .get('/api/tasks/dependencies/graph')
      .set(auth(bearer));
  async function task(bearer = token) {
    const response = await request(app.getHttpServer() as Server)
      .post('/api/tasks')
      .set(auth(bearer))
      .send({ title: 'Dependency task' })
      .expect(201);
    return (response.body as { id: string }).id;
  }

  it('persists canonical replacement with JWT and API token, with read-only graph', async () => {
    const [a, b, c] = await Promise.all([task(), task(), task()]);
    const dependencyIds = [b, c].sort();
    await replace(a, [c, b], apiToken).expect(200, {
      taskId: a,
      dependencyIds,
    });
    await replace(a, [b, c]).expect(200, { taskId: a, dependencyIds });
    const before = await source.query<TaskDependencyEdge[]>(
      'SELECT * FROM task_dependencies ORDER BY taskId, dependencyId',
    );
    const response = await graph(apiToken).expect(200);
    expect(response.body).toEqual(
      expect.arrayContaining(
        dependencyIds.map((dependencyId) => ({ taskId: a, dependencyId })),
      ),
    );
    expect(
      await source.query(
        'SELECT * FROM task_dependencies ORDER BY taskId, dependencyId',
      ),
    ).toEqual(before);
    await replace(a, []).expect(200, { taskId: a, dependencyIds: [] });
    expect(
      ((await graph()).body as TaskDependencyEdge[]).filter(
        (edge: { taskId: string }) => edge.taskId === a,
      ),
    ).toEqual([]);
  });

  it('rejects invalid bodies and unauthenticated access', async () => {
    const a = await task();
    for (const body of [
      {},
      { dependencyIds: null },
      { dependencyIds: 'bad' },
      { dependencyIds: ['bad'] },
    ]) {
      await request(app.getHttpServer() as Server)
        .put(`/api/tasks/${a}/dependencies`)
        .set(auth(token))
        .send(body)
        .expect(400);
    }
    await graph('bad').expect(401);
    await replace(a, [], 'bad').expect(401);
  });

  it('rejects self, duplicates, missing and foreign tasks atomically', async () => {
    const [a, b, foreign] = await Promise.all([
      task(),
      task(),
      task(otherToken),
    ]);
    await replace(a, [b]).expect(200);
    await replace(a, [a]).expect(400);
    await replace(a, [b, b]).expect(400);
    await replace(a, [randomUUID()]).expect(404);
    await replace(a, [foreign]).expect(404);
    await replace(foreign, []).expect(404);
    await replace(randomUUID(), []).expect(404);
    expect((await graph()).body).toContainEqual({ taskId: a, dependencyId: b });
    expect((await graph(otherToken)).body).toEqual([]);
  });

  it('rejects direct and transitive cycles without losing old predecessors', async () => {
    const [a, b, c, d] = await Promise.all([task(), task(), task(), task()]);
    await replace(b, [a]).expect(200);
    await replace(c, [b]).expect(200);
    await replace(a, [d]).expect(200);
    await replace(a, [b]).expect(400);
    await replace(a, [c]).expect(400);
    expect((await graph()).body).toContainEqual({ taskId: a, dependencyId: d });
  });

  it('serializes concurrent opposite edges', async () => {
    const [a, b] = await Promise.all([task(), task()]);
    const responses = await Promise.all([replace(a, [b]), replace(b, [a])]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 400,
    ]);
    const edges = ((await graph()).body as TaskDependencyEdge[]).filter(
      (edge: { taskId: string }) => [a, b].includes(edge.taskId),
    );
    expect(edges).toHaveLength(1);
  });

  it('rolls back deleted predecessors when insertion fails', async () => {
    const [a, b, c] = await Promise.all([task(), task(), task()]);
    await replace(a, [b]).expect(200);
    await source.query(
      `CREATE TRIGGER reject_dependency_insert BEFORE INSERT ON task_dependencies WHEN NEW.dependencyId = '${c}' BEGIN SELECT RAISE(ABORT, 'forced failure'); END`,
    );
    try {
      await replace(a, [c]).expect(500);
      expect((await graph()).body).toContainEqual({
        taskId: a,
        dependencyId: b,
      });
    } finally {
      await source.query('DROP TRIGGER reject_dependency_insert');
    }
  });

  it('cascades deletion of either endpoint', async () => {
    const [a, b, c] = await Promise.all([task(), task(), task()]);
    await replace(b, [a]).expect(200);
    await replace(c, [b]).expect(200);
    await request(app.getHttpServer() as Server)
      .delete(`/api/tasks/${b}`)
      .set(auth(token))
      .expect(200);
    expect(
      ((await graph()).body as TaskDependencyEdge[]).filter(
        (edge: { taskId: string; dependencyId: string }) =>
          edge.taskId === b || edge.dependencyId === b,
      ),
    ).toEqual([]);
  });

  it('keeps links on completion and allows completing a waiting task manually', async () => {
    const [a, b] = await Promise.all([task(), task()]);
    await replace(b, [a]).expect(200);
    await request(app.getHttpServer() as Server)
      .patch(`/api/tasks/${b}`)
      .set(auth(token))
      .send({ completed: true })
      .expect(200);
    expect(
      (await source.getRepository(Task).findOneByOrFail({ id: a })).completed,
    ).toBe(false);
    await request(app.getHttpServer() as Server)
      .patch(`/api/tasks/${b}`)
      .set(auth(token))
      .send({ completed: false })
      .expect(200);
    await request(app.getHttpServer() as Server)
      .patch(`/api/tasks/${a}`)
      .set(auth(token))
      .send({ completed: true })
      .expect(200);
    expect(
      (await source.getRepository(Task).findOneByOrFail({ id: b })).completed,
    ).toBe(false);
    expect((await graph()).body).toContainEqual({ taskId: b, dependencyId: a });
  });

  it('keeps cross-project predecessors when a task moves', async () => {
    const projectIds: string[] = [];
    for (const title of ['First project', 'Second project']) {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/projects')
        .set(auth(token))
        .send({ title, type: 'simple' })
        .expect(201);
      projectIds.push((response.body as { id: string }).id);
    }
    const ids: string[] = [];
    for (const projectId of projectIds) {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/tasks')
        .set(auth(token))
        .send({ title: 'Project dependency', projectId })
        .expect(201);
      ids.push((response.body as { id: string }).id);
    }
    await replace(ids[1], [ids[0]]).expect(200);
    await request(app.getHttpServer() as Server)
      .patch(`/api/projects/${projectIds[0]}/tasks/${ids[1]}/move`)
      .set(auth(token))
      .send({ projectId: projectIds[0] })
      .expect(200);
    expect(
      (await source.getRepository(Task).findOneByOrFail({ id: ids[1] }))
        .projectId,
    ).toBe(projectIds[0]);
    expect((await graph()).body).toContainEqual({
      taskId: ids[1],
      dependencyId: ids[0],
    });
  });

  it('does not inherit dependencies when completing a recurring occurrence', async () => {
    const predecessor = await task();
    const response = await request(app.getHttpServer() as Server)
      .post('/api/tasks')
      .set(auth(token))
      .send({
        title: 'Recurring',
        dueDate: '2030-01-01',
        recurrence: { frequency: 'daily', interval: 1 },
      })
      .expect(201);
    const id = (response.body as { id: string }).id;
    await replace(id, [predecessor]).expect(200);
    const completed = await request(app.getHttpServer() as Server)
      .patch(`/api/tasks/${id}`)
      .set(auth(token))
      .send({ completed: true })
      .expect(200);
    const next = (completed.body as { nextInstance: { id: string } })
      .nextInstance;
    expect(next.id).toBeDefined();
    const edges = (await graph()).body as TaskDependencyEdge[];
    expect(edges).toContainEqual({ taskId: id, dependencyId: predecessor });
    expect(
      edges.filter(
        (edge) => edge.taskId === next.id || edge.dependencyId === next.id,
      ),
    ).toEqual([]);
  });

  it('rejects frozen source mutation while allowing a frozen predecessor', async () => {
    const [a, b] = await Promise.all([task(), task()]);
    await source.getRepository(Task).update(a, { isOverdue: true });
    await replace(a, [b]).expect(400);
    await replace(b, [a]).expect(200);
  });

  it('preserves persisted edges and cascade constraints through schema rebuild and restart', async () => {
    const [a, b] = await Promise.all([task(), task()]);
    await replace(b, [a]).expect(200);
    const directory = await mkdtemp(join(tmpdir(), 'alfy-dependencies-'));
    const database = join(directory, 'restart.sqlite');
    let restarted: DataSource | undefined;
    try {
      await source.query('VACUUM INTO ?', [database]);
      restarted = await initializeWithSchemaSync({
        entities: source.options.entities,
        database,
        type: 'sqlite',
      });
      await restarted.query(
        'ALTER TABLE task_dependencies ADD COLUMN obsolete TEXT',
      );
      await restarted.destroy();
      restarted = await initializeWithSchemaSync({
        entities: source.options.entities,
        database,
        type: 'sqlite',
      });
      expect(
        await restarted.query(
          'SELECT taskId, dependencyId FROM task_dependencies WHERE taskId = ?',
          [b],
        ),
      ).toEqual([{ taskId: b, dependencyId: a }]);
      await restarted.getRepository(Task).delete(a);
      expect(
        await restarted.query(
          'SELECT * FROM task_dependencies WHERE taskId = ?',
          [b],
        ),
      ).toEqual([]);
      expect(await restarted.query('PRAGMA foreign_key_check')).toEqual([]);
    } finally {
      if (restarted?.isInitialized) await restarted.destroy();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
