import { DataSource } from 'typeorm';
import * as entities from '../../../shared/entities';
import { TypeOrmProjectRepository } from './typeorm-project.repository';

describe('перенос проектов в SQLite', () => {
  let db: DataSource;
  let repo: TypeOrmProjectRepository;
  let userId: number;
  beforeEach(async () => {
    db = new DataSource({ type: 'sqlite', database: ':memory:', entities: Object.values(entities), synchronize: true });
    await db.initialize();
    userId = (await db.getRepository(entities.User).save({ telegramId: 999 })).id;
    repo = new TypeOrmProjectRepository(db.getRepository(entities.Project));
  });
  afterEach(async () => { await db.destroy(); });

  it('сохраняет родителя и порядок после повторного чтения', async () => {
    const a = await repo.create({ userId, title: 'A', parentId: null });
    const b = await repo.create({ userId, title: 'B', parentId: null });
    const child = await repo.create({ userId, title: 'Child', parentId: a.id });
    await repo.move(userId, child.id, null, b.id);
    const actual = await repo.findAllByUser(userId);
    expect(actual.find(p => p.id === child.id)?.parentId).toBeNull();
    expect(actual.find(p => p.id === child.id)!.order).toBeLessThan(actual.find(p => p.id === b.id)!.order);
  });

  it('откатывает порядок соседей, если запись родителя не удалась', async () => {
    const a = await repo.create({ userId, title: 'A', parentId: null, order: 0 });
    const b = await repo.create({ userId, title: 'B', parentId: null, order: 1 });
    const child = await repo.create({ userId, title: 'Child', parentId: a.id });
    const before = await repo.findAllByUser(userId);
    await db.query(`CREATE TRIGGER fail_move BEFORE UPDATE ON projects WHEN NEW.id = '${child.id}' BEGIN SELECT RAISE(ABORT, 'forced failure'); END`);
    await expect(repo.move(userId, child.id, null, b.id)).rejects.toThrow('forced failure');
    expect(await repo.findAllByUser(userId)).toEqual(before);
  });

  it('не меняет чужую ветку', async () => {
    const otherUser = await db.getRepository(entities.User).save({ telegramId: 1000 });
    const foreign = await repo.create({ userId: otherUser.id, title: 'Foreign', parentId: null });
    const own = await repo.create({ userId, title: 'Own', parentId: null });
    await expect(repo.move(userId, own.id, foreign.id, null)).rejects.toThrow();
    await expect(repo.move(userId, foreign.id, null, null)).rejects.toThrow();
    expect((await repo.findById(own.id, userId))?.parentId).toBeNull();
    expect((await repo.findById(foreign.id, otherUser.id))?.parentId).toBeNull();
  });
});
