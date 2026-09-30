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
import { TypeOrmProjectRepository } from './typeorm-project.repository';

describe('TypeOrmProjectRepository — префикс ключей задач (in-memory sqlite)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmProjectRepository;

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
    await dataSource.getRepository(User).save([{ id: 1 }, { id: 2 }]);
    repo = new TypeOrmProjectRepository(dataSource.getRepository(Project));
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  const agile = (userId: number, title: string, taskKeyPrefix: string | null) =>
    repo.create({ userId, title, type: 'agile', taskKeyPrefix });

  it('findByTaskKeyPrefix находит проект только среди проектов пользователя', async () => {
    const mine = await agile(1, 'Мой', 'ALF');
    await agile(2, 'Чужой', 'BET');

    expect((await repo.findByTaskKeyPrefix(1, 'ALF'))?.id).toBe(mine.id);
    expect(await repo.findByTaskKeyPrefix(1, 'BET')).toBeNull();
  });

  it('одинаковый префикс у разных пользователей допустим', async () => {
    await agile(1, 'Первый', 'ALF');

    await expect(agile(2, 'Второй', 'ALF')).resolves.toBeDefined();
  });

  it('одинаковый префикс у двух проектов пользователя отклоняется индексом', async () => {
    await agile(1, 'Первый', 'ALF');

    await expect(agile(1, 'Второй', 'ALF')).rejects.toThrow(/UNIQUE/);
  });

  it('несколько проектов без префикса допустимы', async () => {
    await agile(1, 'Первый', null);

    await expect(agile(1, 'Второй', null)).resolves.toBeDefined();
  });

  it('счётчик номеров у нового проекта начинается с 1', async () => {
    const project = await agile(1, 'Новый', null);

    expect(project.nextTaskNumber).toBe(1);
  });
});
