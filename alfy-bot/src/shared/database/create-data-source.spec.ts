import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import {
  BoardGroup,
  Sprint,
  PomodoroConfig,
  Project,
  ProjectColumn,
  Task,
  User,
} from '../entities';
import {
  BOARD_GROUP_TRIGGER_NAMES,
  BoardGroupConstraintsMigrationService,
} from './board-group-constraints.service';
import { initializeWithSchemaSync } from './create-data-source';

const USER_ID = 1;
const PROJECT_A = 'project-a';
const PROJECT_B = 'project-b';

const ENTITIES = [
  User,
  Project,
  ProjectColumn,
  Task,
  PomodoroConfig,
  BoardGroup,
  Sprint,
];

const LEGACY_BOARD_GROUPS_SQL = `
  CREATE TABLE "board_groups" (
    "id" varchar PRIMARY KEY NOT NULL,
    "userId" integer NOT NULL,
    "projectId" varchar NOT NULL,
    "parentId" varchar,
    "type" text NOT NULL,
    "title" varchar NOT NULL,
    "description" text,
    "status" text NOT NULL DEFAULT ('open'),
    "completedAt" datetime,
    "color" text,
    "order" integer NOT NULL DEFAULT (0),
    "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
    "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "CHK_board_group_depth" CHECK ((parentId IS NULL AND type = 'epic') OR (parentId IS NOT NULL AND type = 'story')),
    CONSTRAINT "CHK_board_group_not_self" CHECK (parentId <> id),
    CONSTRAINT "CHK_board_group_status" CHECK (status IN ('open','done')),
    CONSTRAINT "CHK_board_group_type" CHECK (type IN ('epic','story')),
    CONSTRAINT "FK_3b4b251c4423459a9feabb22294" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "FK_7de35d69de336f8c50708d2a7d2" FOREIGN KEY ("parentId") REFERENCES "board_groups" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
  )
`;

function makeOptions(database: string): DataSourceOptions {
  return {
    type: 'sqlite',
    database,
    entities: ENTITIES,
    synchronize: true,
  };
}

async function buildLegacyDatabaseFile(database: string): Promise<void> {
  const dataSource = new DataSource(makeOptions(database));
  await dataSource.initialize();

  await new BoardGroupConstraintsMigrationService(
    dataSource,
  ).onApplicationBootstrap();

  await dataSource.query('DROP TABLE board_groups');
  await dataSource.query(LEGACY_BOARD_GROUPS_SQL);

  await new BoardGroupConstraintsMigrationService(
    dataSource,
  ).onApplicationBootstrap();

  await dataSource.getRepository(User).save({ id: USER_ID });
  await dataSource.getRepository(Project).save([
    { id: PROJECT_A, userId: USER_ID, title: 'Project A' },
    { id: PROJECT_B, userId: USER_ID, title: 'Project B' },
  ]);

  await dataSource.query(
    `INSERT INTO board_groups (id, userId, projectId, parentId, type, title) VALUES (?, ?, ?, NULL, 'epic', ?)`,
    ['epic-1', USER_ID, PROJECT_A, 'Epic 1'],
  );

  await dataSource.getRepository(Task).save({
    id: 'task-1',
    userId: USER_ID,
    title: 'Task 1',
    projectId: PROJECT_A,
    groupId: 'epic-1',
  });

  await dataSource.destroy();
}

describe('initializeWithSchemaSync (файловая sqlite-база)', () => {
  const tmpFiles: string[] = [];

  function tmpDbPath(name: string): string {
    const filePath = path.join(
      os.tmpdir(),
      `alfy-create-data-source-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
    );
    tmpFiles.push(filePath);
    return filePath;
  }

  afterEach(() => {
    for (const filePath of tmpFiles.splice(0)) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  it('контрольный тест: обычный synchronize на базе со старой схемой и уже установленными триггерами падает с ошибкой "no such table: main.board_groups"', async () => {
    const legacyPath = tmpDbPath('legacy-control');
    await buildLegacyDatabaseFile(legacyPath);

    const dataSource = new DataSource(makeOptions(legacyPath));

    await expect(dataSource.initialize()).rejects.toThrow(
      /no such table: main\.board_groups/,
    );

    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('снимает триггеры, синхронизирует схему и переустанавливает триггеры без потери данных', async () => {
    const legacyPath = tmpDbPath('legacy-main');
    await buildLegacyDatabaseFile(legacyPath);

    const dataSource = await initializeWithSchemaSync(makeOptions(legacyPath));

    const columns: { name: string }[] = await dataSource.query(
      'PRAGMA table_info(board_groups)',
    );
    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain('startDate');
    expect(columnNames).toContain('dueDate');

    const epic = await dataSource
      .getRepository(BoardGroup)
      .findOneByOrFail({ id: 'epic-1' });
    expect(epic.projectId).toBe(PROJECT_A);

    const task = await dataSource
      .getRepository(Task)
      .findOneByOrFail({ id: 'task-1' });
    expect(task.groupId).toBe('epic-1');

    await new BoardGroupConstraintsMigrationService(
      dataSource,
    ).onApplicationBootstrap();

    const triggerRows: { name: string }[] = await dataSource.query(
      "SELECT name FROM sqlite_master WHERE type = 'trigger'",
    );
    const triggerNames = triggerRows.map((row) => row.name).sort();
    expect(triggerNames).toEqual([...BOARD_GROUP_TRIGGER_NAMES].sort());

    await expect(
      dataSource.getRepository(Task).save({
        id: 'task-cross-project',
        userId: USER_ID,
        title: 'Cross-project task',
        projectId: PROJECT_B,
        groupId: 'epic-1',
      }),
    ).rejects.toThrow();

    await dataSource.destroy();
  });
});
