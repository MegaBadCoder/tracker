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
} from '../entities';
import { TaskNumberMigrationService } from './task-number-migration.service';

describe('TaskNumberMigrationService (in-memory sqlite)', () => {
  let dataSource: DataSource;
  let service: TaskNumberMigrationService;

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
      { id: 'agile-2', userId: USER_ID, title: 'Agile 2', type: 'agile' },
      { id: 'simple', userId: USER_ID, title: 'Simple', type: 'simple' },
    ]);
    service = new TaskNumberMigrationService(dataSource);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  const addTask = (
    id: string,
    projectId: string | null,
    createdAt: string,
    number: number | null = null,
  ) =>
    dataSource.query(
      'INSERT INTO tasks (id, userId, title, projectId, number, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [id, USER_ID, id, projectId, number, createdAt],
    );

  const numbers = async (projectId: string | null) => {
    const rows: { id: string; number: number | null }[] =
      await dataSource.query(
        'SELECT id, number FROM tasks WHERE projectId IS ? ORDER BY id',
        [projectId],
      );
    return Object.fromEntries(rows.map((r) => [r.id, r.number]));
  };

  const counter = async (id: string) =>
    (await dataSource.getRepository(Project).findOneByOrFail({ id }))
      .nextTaskNumber;

  it('нумерует задачи agile-проекта по createdAt и сдвигает счётчик', async () => {
    await addTask('c', 'agile', '2026-01-03 10:00:00');
    await addTask('a', 'agile', '2026-01-01 10:00:00');
    await addTask('b', 'agile', '2026-01-02 10:00:00');

    await service.onApplicationBootstrap();

    expect(await numbers('agile')).toEqual({ a: 1, b: 2, c: 3 });
    expect(await counter('agile')).toBe(4);
  });

  it('при одинаковом createdAt порядок определяется id', async () => {
    await addTask('y', 'agile', '2026-01-01 10:00:00');
    await addTask('x', 'agile', '2026-01-01 10:00:00');

    await service.onApplicationBootstrap();

    expect(await numbers('agile')).toEqual({ x: 1, y: 2 });
  });

  it('нумерует проекты независимо друг от друга', async () => {
    await addTask('a1', 'agile', '2026-01-01 10:00:00');
    await addTask('b1', 'agile-2', '2026-01-01 10:00:00');
    await addTask('b2', 'agile-2', '2026-01-02 10:00:00');

    await service.onApplicationBootstrap();

    expect(await numbers('agile')).toEqual({ a1: 1 });
    expect(await numbers('agile-2')).toEqual({ b1: 1, b2: 2 });
    expect(await counter('agile-2')).toBe(3);
  });

  it('нумерует задачи проекта с устаревшим viewMode=agile, ещё не получившего type=agile', async () => {
    await dataSource.query(
      'INSERT INTO projects (id, userId, title, viewMode, type, "order") VALUES (?, ?, ?, ?, ?, ?)',
      ['legacy', USER_ID, 'Legacy', 'agile', 'simple', 0],
    );
    await addTask('a', 'legacy', '2026-01-01 10:00:00');

    await service.onApplicationBootstrap();

    expect(await numbers('legacy')).toEqual({ a: 1 });
    expect(await counter('legacy')).toBe(2);
  });

  it('повторный запуск ничего не меняет', async () => {
    await addTask('a', 'agile', '2026-01-01 10:00:00');
    await addTask('b', 'agile', '2026-01-02 10:00:00');

    await service.onApplicationBootstrap();
    await service.onApplicationBootstrap();

    expect(await numbers('agile')).toEqual({ a: 1, b: 2 });
    expect(await counter('agile')).toBe(3);
  });

  it('задачи обычных проектов и Входящих не трогает', async () => {
    await addTask('s', 'simple', '2026-01-01 10:00:00');
    await addTask('i', null, '2026-01-01 10:00:00');

    await service.onApplicationBootstrap();

    expect(await numbers('simple')).toEqual({ s: null });
    expect(await numbers(null)).toEqual({ i: null });
    expect(await counter('simple')).toBe(1);
  });

  it('продолжает после уже выданных номеров и не пересекается с ними', async () => {
    await addTask('old', 'agile', '2026-01-01 10:00:00', 1);
    await addTask('new', 'agile', '2026-01-02 10:00:00');
    await dataSource.query(
      'UPDATE projects SET nextTaskNumber = 2 WHERE id = ?',
      ['agile'],
    );

    await service.onApplicationBootstrap();

    expect(await numbers('agile')).toEqual({ old: 1, new: 2 });
    expect(await counter('agile')).toBe(3);
  });

  it('если счётчик отстаёт от максимального номера, начинает с максимума + 1', async () => {
    await addTask('old', 'agile', '2026-01-01 10:00:00', 5);
    await addTask('new', 'agile', '2026-01-02 10:00:00');

    await service.onApplicationBootstrap();

    expect(await numbers('agile')).toEqual({ old: 5, new: 6 });
    expect(await counter('agile')).toBe(7);
  });

  it('проект без ненумерованных задач не меняет счётчик', async () => {
    await addTask('old', 'agile', '2026-01-01 10:00:00', 1);
    await dataSource.query(
      'UPDATE projects SET nextTaskNumber = 9 WHERE id = ?',
      ['agile'],
    );

    await service.onApplicationBootstrap();

    expect(await counter('agile')).toBe(9);
  });
});
