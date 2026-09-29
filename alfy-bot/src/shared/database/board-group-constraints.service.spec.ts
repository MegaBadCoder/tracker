import { DataSource, Repository } from 'typeorm';
import {
  BoardGroup,
  PomodoroConfig,
  Project,
  ProjectColumn,
  Task,
  User,
} from '../entities';
import { BoardGroupConstraintsMigrationService } from './board-group-constraints.service';

describe('BoardGroupConstraintsMigrationService (in-memory sqlite)', () => {
  let dataSource: DataSource;
  let groupRepo: Repository<BoardGroup>;
  let taskRepo: Repository<Task>;
  let service: BoardGroupConstraintsMigrationService;

  const USER_ID = 1;
  const PROJECT_A = 'project-a';
  const PROJECT_B = 'project-b';

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
      ],
      synchronize: true,
    });
    await dataSource.initialize();

    await dataSource.getRepository(User).save({ id: USER_ID });
    await dataSource.getRepository(Project).save([
      { id: PROJECT_A, userId: USER_ID, title: 'Project A' },
      { id: PROJECT_B, userId: USER_ID, title: 'Project B' },
    ]);

    groupRepo = dataSource.getRepository(BoardGroup);
    taskRepo = dataSource.getRepository(Task);

    service = new BoardGroupConstraintsMigrationService(dataSource);
    await service.onApplicationBootstrap();
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  async function makeEpic(id: string, projectId = PROJECT_A) {
    return groupRepo.save({
      id,
      userId: USER_ID,
      projectId,
      parentId: null,
      type: 'epic',
      title: `Epic ${id}`,
    });
  }

  async function makeStory(
    id: string,
    parentId: string,
    projectId = PROJECT_A,
  ) {
    return groupRepo.save({
      id,
      userId: USER_ID,
      projectId,
      parentId,
      type: 'story',
      title: `Story ${id}`,
    });
  }

  it('1. rejects a group whose parentId points to a non-epic (history) group', async () => {
    await makeEpic('epic-1');
    await makeStory('story-1', 'epic-1');

    await expect(
      groupRepo.save({
        id: 'story-2',
        userId: USER_ID,
        projectId: PROJECT_A,
        parentId: 'story-1',
        type: 'story',
        title: 'Story 2 (invalid parent)',
      }),
    ).rejects.toThrow();
  });

  it('2. rejects setting parentId on a group that already has children', async () => {
    await makeEpic('epic-1');
    await makeStory('story-1', 'epic-1');
    await makeEpic('epic-2');

    const epic1 = await groupRepo.findOneByOrFail({ id: 'epic-1' });
    epic1.parentId = 'epic-2';
    epic1.type = 'story';

    await expect(groupRepo.save(epic1)).rejects.toThrow();
  });

  it('3. rejects parentId = id (self reference)', async () => {
    await expect(
      groupRepo.save({
        id: 'epic-self',
        userId: USER_ID,
        projectId: PROJECT_A,
        parentId: 'epic-self',
        type: 'story',
        title: 'Self referencing',
      }),
    ).rejects.toThrow();
  });

  it('4. rejects type=epic with a non-null parentId', async () => {
    await makeEpic('epic-1');

    await expect(
      groupRepo.save({
        id: 'bad-epic',
        userId: USER_ID,
        projectId: PROJECT_A,
        parentId: 'epic-1',
        type: 'epic',
        title: 'Epic with parent',
      }),
    ).rejects.toThrow();
  });

  it('5. rejects a task whose groupId points to a group from another project', async () => {
    await makeEpic('epic-1', PROJECT_A);
    await makeStory('story-1', 'epic-1', PROJECT_A);

    await expect(
      taskRepo.save({
        id: 'task-1',
        userId: USER_ID,
        title: 'Cross-project task',
        projectId: PROJECT_B,
        groupId: 'story-1',
      }),
    ).rejects.toThrow();
  });

  it('6. re-protects after the table is recreated (as synchronize does on schema change)', async () => {
    const rows: { sql: string }[] = await dataSource.query(
      'SELECT sql FROM sqlite_master WHERE type = ? AND name = ?',
      ['table', 'board_groups'],
    );
    const originalSql = rows[0].sql;

    await makeEpic('epic-1');
    await makeStory('story-1', 'epic-1');

    // Simulate what TypeORM's `synchronize` does when the board_groups schema
    // changes: rename away, recreate with the original DDL, copy rows, drop
    // the renamed table. This is exactly the sequence that silently drops
    // every trigger attached to the table.
    await dataSource.query(
      'ALTER TABLE board_groups RENAME TO board_groups_old',
    );
    await dataSource.query(originalSql);
    await dataSource.query(
      'INSERT INTO board_groups SELECT * FROM board_groups_old',
    );
    await dataSource.query('DROP TABLE board_groups_old');

    // Without re-running the migration service, the trigger protection is gone.
    await expect(
      groupRepo.save({
        id: 'story-2',
        userId: USER_ID,
        projectId: PROJECT_A,
        parentId: 'story-1',
        type: 'story',
        title: 'Story 2 (invalid parent, post schema-change)',
      }),
    ).resolves.toBeDefined();

    await service.onApplicationBootstrap();

    await expect(
      groupRepo.save({
        id: 'story-3',
        userId: USER_ID,
        projectId: PROJECT_A,
        parentId: 'story-1',
        type: 'story',
        title: 'Story 3 (invalid parent, post re-migration)',
      }),
    ).rejects.toThrow();
  });

  it('7. schema recreated with startDate/dueDate columns still rejects a cross-project task after re-migration', async () => {
    const rows: { sql: string }[] = await dataSource.query(
      'SELECT sql FROM sqlite_master WHERE type = ? AND name = ?',
      ['table', 'board_groups'],
    );
    const originalSql = rows[0].sql;
    expect(originalSql).toContain('startDate');
    expect(originalSql).toContain('dueDate');

    await makeEpic('epic-1', PROJECT_A);
    await makeStory('story-1', 'epic-1', PROJECT_A);

    await dataSource.query(
      'ALTER TABLE board_groups RENAME TO board_groups_old',
    );
    await dataSource.query(originalSql);
    await dataSource.query(
      'INSERT INTO board_groups SELECT * FROM board_groups_old',
    );
    await dataSource.query('DROP TABLE board_groups_old');

    await service.onApplicationBootstrap();

    await expect(
      taskRepo.save({
        id: 'task-2',
        userId: USER_ID,
        title: 'Cross-project task, post re-migration',
        projectId: PROJECT_B,
        groupId: 'story-1',
      }),
    ).rejects.toThrow();
  });
});
