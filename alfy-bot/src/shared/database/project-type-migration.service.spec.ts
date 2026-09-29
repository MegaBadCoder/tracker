import { DataSource, Repository } from 'typeorm';
import {
  BoardGroup,
  Sprint,
  PomodoroConfig,
  Project,
  ProjectColumn,
  Task,
  User,
} from '../entities';
import { ProjectTypeMigrationService } from './project-type-migration.service';

describe('ProjectTypeMigrationService (in-memory sqlite)', () => {
  let dataSource: DataSource;
  let projectRepo: Repository<Project>;
  let service: ProjectTypeMigrationService;

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
      ],
      synchronize: true,
    });
    await dataSource.initialize();

    await dataSource.getRepository(User).save({ id: USER_ID });

    projectRepo = dataSource.getRepository(Project);
    service = new ProjectTypeMigrationService(dataSource);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('переносит type=agile существующим проектам с viewMode=agile, оставляя viewMode нетронутым', async () => {
    await dataSource.query(
      'INSERT INTO projects (id, userId, title, viewMode, type, "order") VALUES (?, ?, ?, ?, ?, ?)',
      ['proj-agile', USER_ID, 'Agile', 'agile', 'simple', 0],
    );

    await service.onApplicationBootstrap();

    const project = await projectRepo.findOneByOrFail({ id: 'proj-agile' });
    expect(project.type).toBe('agile');
    expect(project.viewMode).toBe('agile');
  });

  it('повторный вызов идемпотентен — ничего не ломает и не меняет', async () => {
    await dataSource.query(
      'INSERT INTO projects (id, userId, title, viewMode, type, "order") VALUES (?, ?, ?, ?, ?, ?)',
      ['proj-agile', USER_ID, 'Agile', 'agile', 'simple', 0],
    );

    await service.onApplicationBootstrap();
    await service.onApplicationBootstrap();

    const project = await projectRepo.findOneByOrFail({ id: 'proj-agile' });
    expect(project.type).toBe('agile');
    expect(project.viewMode).toBe('agile');
  });

  it('проект с viewMode=board остаётся type=simple', async () => {
    await projectRepo.save({
      id: 'proj-board',
      userId: USER_ID,
      title: 'Board',
      viewMode: 'board',
    });

    await service.onApplicationBootstrap();

    const project = await projectRepo.findOneByOrFail({ id: 'proj-board' });
    expect(project.type).toBe('simple');
    expect(project.viewMode).toBe('board');
  });

  it('проект с viewMode=list остаётся type=simple', async () => {
    await projectRepo.save({
      id: 'proj-list',
      userId: USER_ID,
      title: 'List',
      viewMode: 'list',
    });

    await service.onApplicationBootstrap();

    const project = await projectRepo.findOneByOrFail({ id: 'proj-list' });
    expect(project.type).toBe('simple');
    expect(project.viewMode).toBe('list');
  });
});
