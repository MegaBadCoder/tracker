import { DataSource, Repository } from 'typeorm';
import {
  BoardGroup,
  PomodoroConfig,
  Project,
  ProjectColumn,
  Sprint,
  Task,
  User,
} from '../../../shared/entities';
import { TypeOrmSprintRepository } from './typeorm-sprint.repository';

describe('TypeOrmSprintRepository (in-memory sqlite)', () => {
  let dataSource: DataSource;
  let sprintRepo: Repository<Sprint>;
  let taskRepo: Repository<Task>;
  let repository: TypeOrmSprintRepository;

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
      ],
      synchronize: true,
    });
    await dataSource.initialize();

    await dataSource.getRepository(User).save({ id: USER_ID });
    await dataSource.getRepository(Project).save([
      { id: PROJECT_A, userId: USER_ID, title: 'Project A' },
      { id: PROJECT_B, userId: USER_ID, title: 'Project B' },
    ]);

    sprintRepo = dataSource.getRepository(Sprint);
    taskRepo = dataSource.getRepository(Task);
    repository = new TypeOrmSprintRepository(sprintRepo, dataSource);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  function makeSprint(
    id: string,
    overrides: Partial<Sprint> = {},
  ): Promise<Sprint> {
    return repository.create({
      id,
      userId: USER_ID,
      projectId: PROJECT_A,
      name: `Sprint ${id}`,
      ...overrides,
    });
  }

  function makeTask(
    id: string,
    sprintId: string | null,
    completed: boolean,
  ): Promise<Task> {
    return taskRepo.save({
      id,
      userId: USER_ID,
      title: id,
      projectId: PROJECT_A,
      sprintId,
      completed,
    });
  }

  describe('closeAndMoveUnfinished', () => {
    it('переносит только незавершённые задачи этого спринта, закрывает спринт и ставит completedAt', async () => {
      await makeSprint('s1', { status: 'active' });
      await makeSprint('s2');
      await makeSprint('s3');
      await makeTask('done', 's1', true);
      await makeTask('todo-1', 's1', false);
      await makeTask('todo-2', 's1', false);
      await makeTask('other-sprint', 's3', false);
      await makeTask('backlog', null, false);

      await repository.closeAndMoveUnfinished('s1', 's2');

      const byId = async (id: string) =>
        (await taskRepo.findOneByOrFail({ id })).sprintId;
      expect(await byId('done')).toBe('s1');
      expect(await byId('todo-1')).toBe('s2');
      expect(await byId('todo-2')).toBe('s2');
      expect(await byId('other-sprint')).toBe('s3');
      expect(await byId('backlog')).toBeNull();

      const closed = await sprintRepo.findOneByOrFail({ id: 's1' });
      expect(closed.status).toBe('closed');
      expect(closed.completedAt).toBeInstanceOf(Date);
    });

    it('с moveToSprintId = null отправляет незавершённые задачи в бэклог', async () => {
      await makeSprint('s1', { status: 'active' });
      await makeTask('done', 's1', true);
      await makeTask('todo', 's1', false);

      await repository.closeAndMoveUnfinished('s1', null);

      expect((await taskRepo.findOneByOrFail({ id: 'todo' })).sprintId).toBe(
        null,
      );
      expect((await taskRepo.findOneByOrFail({ id: 'done' })).sprintId).toBe(
        's1',
      );
    });

    it('откатывает закрытие, если перенос задач упал', async () => {
      await makeSprint('s1', { status: 'active' });
      await makeTask('todo', 's1', false);

      await expect(
        repository.closeAndMoveUnfinished('s1', 'missing-sprint'),
      ).rejects.toThrow();

      const sprint = await sprintRepo.findOneByOrFail({ id: 's1' });
      expect(sprint.status).toBe('active');
      expect(sprint.completedAt).toBeNull();
      expect((await taskRepo.findOneByOrFail({ id: 'todo' })).sprintId).toBe(
        's1',
      );
    });
  });

  describe('уникальный индекс активного спринта', () => {
    it('отвергает второй active-спринт в том же проекте', async () => {
      await makeSprint('s1', { status: 'active' });
      await expect(makeSprint('s2', { status: 'active' })).rejects.toThrow(
        /UNIQUE/,
      );
    });

    it('разрешает active-спринты в разных проектах и сколько угодно planned/closed', async () => {
      await makeSprint('s1', { status: 'active' });
      await makeSprint('s2', { status: 'active', projectId: PROJECT_B });
      await makeSprint('s3');
      await makeSprint('s4');
      await makeSprint('s5', { status: 'closed' });

      expect(await sprintRepo.count()).toBe(5);
    });
  });

  describe('удаление', () => {
    it('SET NULL: задачи удалённого спринта остаются с sprintId = null', async () => {
      await makeSprint('s1');
      await makeTask('t1', 's1', false);

      expect(await repository.delete('s1', PROJECT_A)).toBe(true);

      expect(
        (await taskRepo.findOneByOrFail({ id: 't1' })).sprintId,
      ).toBeNull();
    });

    it('не удаляет спринт другого проекта', async () => {
      await makeSprint('s1');
      expect(await repository.delete('s1', PROJECT_B)).toBe(false);
      expect(await sprintRepo.count()).toBe(1);
    });
  });

  describe('выборки', () => {
    it('findAllByProject отдаёт спринты проекта по order', async () => {
      await makeSprint('s2', { order: 1 });
      await makeSprint('s1', { order: 0 });
      await makeSprint('other', { projectId: PROJECT_B });

      const result = await repository.findAllByProject(PROJECT_A);

      expect(result.map((s) => s.id)).toEqual(['s1', 's2']);
    });

    it('findActive отдаёт активный спринт проекта или null', async () => {
      await makeSprint('s1');
      expect(await repository.findActive(PROJECT_A)).toBeNull();
      await makeSprint('s2', { status: 'active' });
      expect((await repository.findActive(PROJECT_A))?.id).toBe('s2');
    });

    it('findById учитывает проект', async () => {
      await makeSprint('s1');
      expect(await repository.findById('s1', PROJECT_B)).toBeNull();
      expect((await repository.findById('s1', PROJECT_A))?.id).toBe('s1');
    });
  });
});
