import { TypeOrmProjectColumnRepository } from './typeorm-project-column.repository';
import { ProjectService } from '../project.service';
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
  it('последовательные проверки исключают цикл при одновременных переносах', async () => {
    const a = await repo.create({ userId, title: 'A', parentId: null });
    const b = await repo.create({ userId, title: 'B', parentId: null });
    const results = await Promise.allSettled([
      repo.move(userId, a.id, b.id, null),
      repo.move(userId, b.id, a.id, null),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const actual = await repo.findAllByUser(userId);
    expect(actual.filter(project => project.parentId === null)).toHaveLength(1);
  });

  it('старый update не позволяет вложить проект в своего потомка', async () => {
    const a = await repo.create({ userId, title: 'A', parentId: null });
    const b = await repo.create({ userId, title: 'B', parentId: a.id });
    await expect(repo.update(userId, a.id, { parentId: b.id })).rejects.toThrow('cycles');
    expect((await repo.findById(a.id, userId))?.parentId).toBeNull();
  });

  it('редактирование названия не откатывает одновременный перенос', async () => {
    const a = await repo.create({ userId, title: 'A', parentId: null });
    const b = await repo.create({ userId, title: 'B', parentId: null });
    await Promise.all([repo.move(userId, a.id, b.id, null), repo.update(userId, a.id, { title: 'Renamed', parentId: undefined })]);
    expect(await repo.findById(a.id, userId)).toMatchObject({ title: 'Renamed', parentId: b.id });
  });

  it('сохраняет префикс Agile-проекта при редактировании и переносе', async () => {
    const parent = await repo.create({ userId, title: 'Parent' });
    const project = await repo.create({ userId, title: 'Agile', type: 'agile', taskKeyPrefix: 'OLD' });
    await repo.update(userId, project.id, { taskKeyPrefix: 'NEW' });
    await repo.move(userId, project.id, parent.id, null);
    expect(await repo.findById(project.id, userId)).toMatchObject({ taskKeyPrefix: 'NEW', parentId: parent.id, type: 'agile' });
  });

  it('чужой ID в reorder не меняет ни свои, ни чужие проекты', async () => {
    const otherUser = await db.getRepository(entities.User).save({ telegramId: 1001 });
    const foreign = await repo.create({ userId: otherUser.id, title: 'Foreign', parentId: null, order: 7 });
    const own = await repo.create({ userId, title: 'Own', parentId: null, order: 5 });
    await expect(new ProjectService(repo, new TypeOrmProjectColumnRepository(db.getRepository(entities.ProjectColumn))).reorder(userId, [own.id, foreign.id])).rejects.toThrow();
    expect((await repo.findById(own.id, userId))?.order).toBe(5);
    expect((await repo.findById(foreign.id, otherUser.id))?.order).toBe(7);
  });

});
