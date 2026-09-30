import { DataSource } from 'typeorm';
import {
  BoardGroup,
  PomodoroConfig,
  Project,
  ProjectColumn,
  Release,
  Sprint,
  Task,
  User,
} from '../../../shared/entities';
import { TypeOrmTaskNumberAdapter } from './typeorm-task-number.adapter';

describe('TypeOrmTaskNumberAdapter (in-memory sqlite)', () => {
  let dataSource: DataSource;
  let adapter: TypeOrmTaskNumberAdapter;

  const USER_ID = 1;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [
        User,
        Project,
        ProjectColumn,
        Task,
        PomodoroConfig,
        BoardGroup,
        Sprint,
        Release,
      ],
      synchronize: true,
    });
    await dataSource.initialize();
    await dataSource.getRepository(User).save({ id: USER_ID });
    await dataSource.getRepository(Project).save([
      { id: 'agile', userId: USER_ID, title: 'Agile', type: 'agile' },
      { id: 'simple', userId: USER_ID, title: 'Simple', type: 'simple' },
    ]);
    adapter = new TypeOrmTaskNumberAdapter(dataSource);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  const counter = async (id: string) =>
    (await dataSource.getRepository(Project).findOneByOrFail({ id }))
      .nextTaskNumber;

  it('выдаёт подряд 1, 2, 3 и двигает счётчик', async () => {
    expect(await adapter.allocate('agile')).toBe(1);
    expect(await adapter.allocate('agile')).toBe(2);
    expect(await adapter.allocate('agile')).toBe(3);
    expect(await counter('agile')).toBe(4);
  });

  it('параллельные вызовы получают разные номера', async () => {
    const numbers = await Promise.all(
      Array.from({ length: 10 }, () => adapter.allocate('agile')),
    );
    expect([...numbers].sort((a, b) => a! - b!)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it('для обычного проекта возвращает null и не двигает счётчик', async () => {
    expect(await adapter.allocate('simple')).toBeNull();
    expect(await counter('simple')).toBe(1);
  });

  it('для null-проекта возвращает null', async () => {
    expect(await adapter.allocate(null)).toBeNull();
  });

  it('для несуществующего проекта возвращает null', async () => {
    expect(await adapter.allocate('nope')).toBeNull();
  });

  it('счётчик не откатывается после удаления задачи', async () => {
    const taskRepo = dataSource.getRepository(Task);
    const first = await taskRepo.save({
      userId: USER_ID,
      title: 'A',
      projectId: 'agile',
      number: await adapter.allocate('agile'),
    });
    const second = await taskRepo.save({
      userId: USER_ID,
      title: 'B',
      projectId: 'agile',
      number: await adapter.allocate('agile'),
    });
    await taskRepo.delete(second.id);

    expect(first.number).toBe(1);
    expect(await adapter.allocate('agile')).toBe(3);
  });
});
