import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/test-app';
import { User } from '../src/shared/entities';

describe('API tokens (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let otherToken: string;
  const url = '/api/auth/api-tokens';
  const auth = (value: string) => ({ Authorization: `Bearer ${value}` });

  beforeAll(async () => {
    const context = await createTestApp();
    app = context.app;
    token = context.token;
    const other = await app
      .get(DataSource)
      .getRepository(User)
      .save({ telegramId: 998, username: 'other' });
    otherToken = app.get(JwtService).sign({ telegramId: 998, sub: other.id });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a token once and exposes plaintext only in the creation response', async () => {
    const created = await request(app.getHttpServer())
      .post(url)
      .set(auth(token))
      .send({ name: '  Codex  ', userId: 999 })
      .expect(201);
    expect(created.headers['cache-control']).toBe('no-store');
    expect(created.body).toEqual({
      id: expect.any(Number),
      plaintext: expect.stringMatching(/^[a-f0-9]{48}$/),
    });

    const listed = await request(app.getHttpServer())
      .get(url)
      .set(auth(token))
      .expect(200);
    expect(listed.headers['cache-control']).toBe('no-store');
    expect(listed.body).toContainEqual({
      id: created.body.id,
      name: 'Codex',
      prefix: created.body.plaintext.slice(0, 10),
      created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      last_used_at: null,
    });
    expect(JSON.stringify(listed.body)).not.toContain(created.body.plaintext);
  });

  it('lists only the owner’s tokens', async () => {
    const own = await request(app.getHttpServer())
      .post(url)
      .set(auth(otherToken))
      .send({ name: 'Other token' })
      .expect(201);
    const listed = await request(app.getHttpServer())
      .get(url)
      .set(auth(token))
      .expect(200);
    expect(listed.body.some((entry: { id: number }) => entry.id === own.body.id)).toBe(false);
  });

  it('rejects foreign and repeated revocation', async () => {
    const created = await request(app.getHttpServer())
      .post(url)
      .set(auth(token))
      .send({ name: 'Revoke me' })
      .expect(201);
    const target = `${url}/${created.body.id}`;
    await request(app.getHttpServer()).delete(target).set(auth(otherToken)).expect(404);
    const revoked = await request(app.getHttpServer())
      .delete(target)
      .set(auth(token))
      .expect(204);
    expect(revoked.headers['cache-control']).toBe('no-store');
    await request(app.getHttpServer()).delete(target).set(auth(token)).expect(404);
  });

  it.each(['', '  ', 'x'.repeat(101), 123, null])('rejects invalid token name %j', async (name) => {
    await request(app.getHttpServer())
      .post(url)
      .set(auth(token))
      .send({ name })
      .expect(400);
  });

  it.each(['abc', '0', '-1', '1.2'])('rejects invalid token id %s', async (id) => {
    await request(app.getHttpServer())
      .delete(`${url}/${id}`)
      .set(auth(token))
      .expect(400);
  });

  it('rejects missing JWT on every method', async () => {
    await request(app.getHttpServer()).get(url).expect(401);
    await request(app.getHttpServer()).post(url).send({ name: 'Denied' }).expect(401);
    await request(app.getHttpServer()).delete(`${url}/1`).expect(401);
  });

  it('allows task access until revocation but never token management with an API token', async () => {
    const created = await request(app.getHttpServer())
      .post(url)
      .set(auth(token))
      .send({ name: 'Agent' })
      .expect(201);
    const apiToken = created.body.plaintext as string;
    await request(app.getHttpServer()).get('/api/tasks').set(auth(apiToken)).expect(200);
    await request(app.getHttpServer()).get(url).set(auth(apiToken)).expect(401);
    await request(app.getHttpServer()).post(url).set(auth(apiToken)).send({ name: 'Denied' }).expect(401);
    await request(app.getHttpServer()).delete(`${url}/${created.body.id}`).set(auth(apiToken)).expect(401);
    await request(app.getHttpServer()).delete(`${url}/${created.body.id}`).set(auth(token)).expect(204);
    await request(app.getHttpServer()).get('/api/tasks').set(auth(apiToken)).expect(401);
  });
});
