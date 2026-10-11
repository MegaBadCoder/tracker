import { DataSource, Repository } from 'typeorm';
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
import { TypeOrmReleaseRepository } from './typeorm-release.repository';

describe('TypeOrmReleaseRepository (in-memory sqlite)', () => {
  let dataSource: DataSource;
  let releaseRepo: Repository<Release>;
  let taskRepo: Repository<Task>;
  let repository: TypeOrmReleaseRepository;

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
        Sprint,
        Release,
      ],
      synchronize: true,
    });
    await dataSource.initialize();

    await dataSource.getRepository(User).save({ id: USER_ID });
    await dataSource.getRepository(Project).save([
      { id: PROJECT_A, userId: USER_ID, title: 'Project A' },
      { id: PROJECT_B, userId: USER_ID, title: 'Project B' },
    ]);
    await dataSource.getRepository(BoardGroup).save([
      {
        id: 'epic-a',
        userId: USER_ID,
        projectId: PROJECT_A,
        type: 'epic',
        title: 'Epic A',
      },
      {
        id: 'story-a',
        userId: USER_ID,
        projectId: PROJECT_A,
        parentId: 'epic-a',
        type: 'story',
        title: 'Story A',
      },
      {
        id: 'other-a',
        userId: USER_ID,
        projectId: PROJECT_A,
        type: 'epic',
        title: 'Other A',
      },
    ]);

    releaseRepo = dataSource.getRepository(Release);
    taskRepo = dataSource.getRepository(Task);
    repository = new TypeOrmReleaseRepository(releaseRepo, dataSource);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  function makeRelease(
    id: string,
    overrides: Partial<Release> = {},
  ): Promise<Release> {
    return repository.create({
      id,
      userId: USER_ID,
      projectId: PROJECT_A,
      name: `Release ${id}`,
      ...overrides,
    });
  }

  function makeTask(
    id: string,
    releaseId: string | null,
    completed: boolean,
    overrides: Partial<Task> = {},
  ): Promise<Task> {
    return taskRepo.save({
      id,
      userId: USER_ID,
      title: id,
      projectId: PROJECT_A,
      releaseId,
      completed,
      ...overrides,
    });
  }

  const releaseIdOf = async (id: string) =>
    (await taskRepo.findOneByOrFail({ id })).releaseId;

  describe('releaseAndMoveUnfinished', () => {
    it('переносит только незавершённые задачи этого релиза, выпускает релиз и ставит releasedAt', async () => {
      await makeRelease('r1');
      await makeRelease('r2');
      await makeRelease('r3');
      await makeTask('done', 'r1', true);
      await makeTask('todo-1', 'r1', false);
      await makeTask('todo-2', 'r1', false);
      await makeTask('other-release', 'r3', false);
      await makeTask('no-release', null, false);

      await repository.releaseAndMoveUnfinished('r1', 'r2');

      expect(await releaseIdOf('done')).toBe('r1');
      expect(await releaseIdOf('todo-1')).toBe('r2');
      expect(await releaseIdOf('todo-2')).toBe('r2');
      expect(await releaseIdOf('other-release')).toBe('r3');
      expect(await releaseIdOf('no-release')).toBeNull();

      const released = await releaseRepo.findOneByOrFail({ id: 'r1' });
      expect(released.status).toBe('released');
      expect(released.releasedAt).toBeInstanceOf(Date);
    });

    it('с moveToReleaseId = null снимает релиз с незавершённых задач', async () => {
      await makeRelease('r1');
      await makeTask('done', 'r1', true);
      await makeTask('todo', 'r1', false);

      await repository.releaseAndMoveUnfinished('r1', null);

      expect(await releaseIdOf('todo')).toBeNull();
      expect(await releaseIdOf('done')).toBe('r1');
    });

    it('откатывает выпуск, если перенос задач упал', async () => {
      await makeRelease('r1');
      await makeTask('todo', 'r1', false);

      await expect(
        repository.releaseAndMoveUnfinished('r1', 'missing-release'),
      ).rejects.toThrow();

      const release = await releaseRepo.findOneByOrFail({ id: 'r1' });
      expect(release.status).toBe('planned');
      expect(release.releasedAt).toBeNull();
      expect(await releaseIdOf('todo')).toBe('r1');
    });
  });

  describe('assignGroupTasks', () => {
    it('меняет только задачи перечисленных групп и возвращает их число', async () => {
      await makeRelease('r1');
      await makeTask('epic-task', null, false, { groupId: 'epic-a' });
      await makeTask('story-task', null, true, { groupId: 'story-a' });
      await makeTask('other-group', null, false, { groupId: 'other-a' });
      await makeTask('no-group', null, false);

      const updated = await repository.assignGroupTasks('r1', [
        'epic-a',
        'story-a',
      ]);

      expect(updated).toBe(2);
      expect(await releaseIdOf('epic-task')).toBe('r1');
      expect(await releaseIdOf('story-task')).toBe('r1');
      expect(await releaseIdOf('other-group')).toBeNull();
      expect(await releaseIdOf('no-group')).toBeNull();
    });

    it('не трогает задачи других проектов', async () => {
      await makeRelease('r1');
      await makeTask('same-project', null, false, { groupId: 'epic-a' });
      await dataSource.query(
        `INSERT INTO board_groups (id, userId, projectId, type, title, status, "order")
         VALUES ('epic-b', ${USER_ID}, '${PROJECT_B}', 'epic', 'Epic B', 'open', 0)`,
      );
      await makeTask('foreign', null, false, {
        projectId: PROJECT_B,
        groupId: 'epic-b',
      });

      const updated = await repository.assignGroupTasks('r1', [
        'epic-a',
        'epic-b',
      ]);

      expect(updated).toBe(1);
      expect(await releaseIdOf('same-project')).toBe('r1');
      expect(await releaseIdOf('foreign')).toBeNull();
    });

    it('не забирает задачи из выпущенного релиза — его история не переписывается', async () => {
      await makeRelease('r1');
      await makeRelease('r-old', {
        status: 'released',
        releasedAt: new Date(),
      });
      await makeTask('shipped', 'r-old', true, { groupId: 'epic-a' });
      await makeTask('open', null, false, { groupId: 'epic-a' });

      const updated = await repository.assignGroupTasks('r1', ['epic-a']);

      expect(updated).toBe(1);
      expect(await releaseIdOf('shipped')).toBe('r-old');
      expect(await releaseIdOf('open')).toBe('r1');
    });

    it('с пустым списком групп ничего не меняет и возвращает 0', async () => {
      await makeRelease('r1');
      await makeTask('t', null, false, { groupId: 'epic-a' });

      expect(await repository.assignGroupTasks('r1', [])).toBe(0);
      expect(await releaseIdOf('t')).toBeNull();
    });
  });

  describe('релиз истории', () => {
    const storyRelease = async () => {
      const story = await dataSource
        .getRepository(BoardGroup)
        .findOneByOrFail({ id: 'story-a' });
      return (story as BoardGroup & { releaseId?: string | null }).releaseId;
    };

    it('назначает релиз истории даже без задач', async () => {
      await makeRelease('r1');
      await repository.assignGroupTasks('r1', ['story-a']);
      expect(await storyRelease()).toBe('r1');
    });

    it('выпуск переносит открытую историю вместе с её незавершёнными задачами', async () => {
      await makeRelease('r1');
      await makeRelease('r2');
      await repository.assignGroupTasks('r1', ['story-a']);
      await repository.releaseAndMoveUnfinished('r1', 'r2');
      expect(await storyRelease()).toBe('r2');
    });

    it('очистка сохраняет задачи выпущенного релиза', async () => {
      await makeRelease('r1');
      await makeRelease('old', { status: 'released', releasedAt: new Date() });
      await repository.assignGroupTasks('r1', ['story-a']);
      await makeTask('shipped', 'old', true, { groupId: 'story-a' });
      await makeTask('current', 'r1', false, { groupId: 'story-a' });
      await repository.setGroupRelease(PROJECT_A, ['story-a'], null);
      expect(await storyRelease()).toBeNull();
      expect(await releaseIdOf('shipped')).toBe('old');
      expect(await releaseIdOf('current')).toBeNull();
    });

    it('ошибка обновления задачи откатывает назначение истории', async () => {
      await makeRelease('r1');
      await makeTask('current', null, false, { groupId: 'story-a' });
      await dataSource.query(
        `CREATE TRIGGER reject_task_release BEFORE UPDATE OF releaseId ON tasks BEGIN SELECT RAISE(ABORT, 'test write failure'); END`,
      );
      await expect(
        repository.setGroupRelease(PROJECT_A, ['story-a'], 'r1'),
      ).rejects.toThrow('test write failure');
      expect(await storyRelease()).toBeNull();
      expect(await releaseIdOf('current')).toBeNull();
    });

    it('массовое назначение сохраняет релиз завершённой выпущенной истории', async () => {
      await makeRelease('r1');
      await makeRelease('r2');
      await repository.assignGroupTasks('r1', ['story-a']);
      await dataSource
        .getRepository(BoardGroup)
        .update('story-a', { status: 'done' });
      await repository.releaseAndMoveUnfinished('r1', 'r2');
      await repository.assignGroupTasks('r2', ['epic-a', 'story-a']);
      expect(await storyRelease()).toBe('r1');
    });

    it('удаление релиза очищает связь истории', async () => {
      await makeRelease('r1');
      await repository.assignGroupTasks('r1', ['story-a']);
      await repository.delete('r1', PROJECT_A);
      expect(await storyRelease()).toBeNull();
    });
  });

  describe('удаление', () => {
    it('SET NULL: задачи удалённого релиза остаются с releaseId = null', async () => {
      await makeRelease('r1');
      await makeTask('t1', 'r1', false);

      expect(await repository.delete('r1', PROJECT_A)).toBe(true);

      expect(await releaseIdOf('t1')).toBeNull();
    });

    it('не удаляет релиз другого проекта', async () => {
      await makeRelease('r1');
      expect(await repository.delete('r1', PROJECT_B)).toBe(false);
      expect(await releaseRepo.count()).toBe(1);
    });
  });

  describe('выборки', () => {
    it('findAllByProject отдаёт релизы проекта по order', async () => {
      await makeRelease('r2', { order: 1 });
      await makeRelease('r1', { order: 0 });
      await makeRelease('other', { projectId: PROJECT_B });

      const result = await repository.findAllByProject(PROJECT_A);

      expect(result.map((r) => r.id)).toEqual(['r1', 'r2']);
    });

    it('findById учитывает проект', async () => {
      await makeRelease('r1');
      expect(await repository.findById('r1', PROJECT_B)).toBeNull();
      expect((await repository.findById('r1', PROJECT_A))?.id).toBe('r1');
    });
  });

  describe('ограничения', () => {
    it('отвергает статус вне planned/released', async () => {
      await expect(
        makeRelease('r1', { status: 'archived' as Release['status'] }),
      ).rejects.toThrow(/CHK_release_status|CHECK/);
    });

    it('отвергает startDate позже releaseDate', async () => {
      await expect(
        makeRelease('r1', {
          startDate: '2026-02-01',
          releaseDate: '2026-01-01',
        }),
      ).rejects.toThrow(/CHK_release_date_order|CHECK/);
    });
  });
});
