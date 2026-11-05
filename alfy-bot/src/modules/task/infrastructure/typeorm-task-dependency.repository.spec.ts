import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import * as entities from '../../../shared/entities';
import { Task, TaskDependency, User } from '../../../shared/entities';
import { createSerializedSqliteDataSource } from '../../../shared/database/serialized-sqlite';
import { TypeOrmTaskDependencyRepository } from './typeorm-task-dependency.repository';

describe('TypeOrmTaskDependencyRepository schema', () => {
  let source: DataSource;
  let repository: TypeOrmTaskDependencyRepository;
  let a: Task;
  let b: Task;
  let foreign: Task;

  beforeAll(async () => {
    source = createSerializedSqliteDataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: Object.values(entities),
      synchronize: true,
    });
    await source.initialize();
    repository = new TypeOrmTaskDependencyRepository(source);
    const owner = await source
      .getRepository(User)
      .save({ username: 'dependency-owner' });
    const other = await source
      .getRepository(User)
      .save({ username: 'dependency-other' });
    [a, b, foreign] = await source.getRepository(Task).save([
      { title: 'A', userId: owner.id },
      { title: 'B', userId: owner.id },
      { title: 'Foreign', userId: other.id },
    ]);
  });

  afterAll(async () => {
    await source.destroy();
  });
  beforeEach(async () => {
    await source.getRepository(TaskDependency).clear();
  });

  it('enforces pair uniqueness and both foreign keys', async () => {
    const edges = source.getRepository(TaskDependency);
    await edges.insert({ taskId: a.id, dependencyId: b.id });
    await expect(
      edges.insert({ taskId: a.id, dependencyId: b.id }),
    ).rejects.toThrow('UNIQUE');
    await expect(
      edges.insert({ taskId: randomUUID(), dependencyId: b.id }),
    ).rejects.toThrow('FOREIGN KEY');
    await expect(
      edges.insert({ taskId: a.id, dependencyId: randomUUID() }),
    ).rejects.toThrow('FOREIGN KEY');
  });

  it('filters graph by the owners of both endpoints even for corrupt direct writes', async () => {
    await source.getRepository(TaskDependency).insert([
      { taskId: a.id, dependencyId: b.id },
      { taskId: a.id, dependencyId: foreign.id },
      { taskId: foreign.id, dependencyId: b.id },
    ]);
    expect(await repository.graph(a.userId)).toEqual([
      { taskId: a.id, dependencyId: b.id },
    ]);
    expect(await repository.graph(foreign.userId)).toEqual([]);
  });
});
