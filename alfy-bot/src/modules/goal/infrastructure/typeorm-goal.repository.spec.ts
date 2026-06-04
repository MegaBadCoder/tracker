import { DataSource, Repository } from 'typeorm';
import { Goal, Question, Schedule, User } from '../../../shared/entities';
import { TypeOrmGoalRepository } from './typeorm-goal.repository';

describe('TypeOrmGoalRepository (in-memory sqlite)', () => {
  let dataSource: DataSource;
  let goalRepo: Repository<Goal>;
  let questionRepo: Repository<Question>;
  let repo: TypeOrmGoalRepository;

  const USER_A = 1;
  const USER_B = 2;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [Goal, Question, Schedule, User],
      synchronize: true,
    });
    await dataSource.initialize();
    goalRepo = dataSource.getRepository(Goal);
    questionRepo = dataSource.getRepository(Question);
    const userRepo = dataSource.getRepository(User);
    await userRepo.save([{ id: USER_A }, { id: USER_B }]);
    repo = new TypeOrmGoalRepository(goalRepo, questionRepo);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('persists is_global and parent_goal_id columns on create', async () => {
    const global = await repo.create(USER_A, {
      goal_name: 'Global',
      is_global: true,
    });
    expect(global.is_global).toBe(true);

    const child = await repo.create(USER_A, {
      goal_name: 'Child',
      goal_start: '2026-01-01',
      goal_end: '2026-12-31',
      parent_goal_id: global.id,
    });

    const reloaded = await goalRepo.findOne({ where: { id: child.id } });
    expect(reloaded?.parent_goal_id).toBe(global.id);
    expect(reloaded?.is_global).toBe(false);
  });

  it('create allows missing dates (null goal_start/goal_end)', async () => {
    const global = await repo.create(USER_A, {
      goal_name: 'No dates',
      is_global: true,
    });
    const reloaded = await goalRepo.findOne({ where: { id: global.id } });
    expect(reloaded?.goal_start ?? null).toBeNull();
    expect(reloaded?.goal_end ?? null).toBeNull();
  });

  it('findChildren returns only children of the given parent, excluding deleted', async () => {
    const parent = await repo.create(USER_A, {
      goal_name: 'Parent',
      is_global: true,
    });
    const otherParent = await repo.create(USER_A, {
      goal_name: 'Other',
      is_global: true,
    });

    const childA = await repo.create(USER_A, {
      goal_name: 'A',
      goal_start: '2026-01-01',
      goal_end: '2026-12-31',
      parent_goal_id: parent.id,
    });
    const childDeleted = await repo.create(USER_A, {
      goal_name: 'Deleted',
      goal_start: '2026-01-01',
      goal_end: '2026-12-31',
      parent_goal_id: parent.id,
    });
    await repo.updateGoalStatus(childDeleted.id, 'deleted');
    await repo.create(USER_A, {
      goal_name: 'Other child',
      goal_start: '2026-01-01',
      goal_end: '2026-12-31',
      parent_goal_id: otherParent.id,
    });

    const children = await repo.findChildren(parent.id);
    expect(children.map((c) => c.id)).toEqual([childA.id]);
  });

  it('findAllByUser filters by scope global/regular/all', async () => {
    const global = await repo.create(USER_A, {
      goal_name: 'Global',
      is_global: true,
    });
    const regular = await repo.create(USER_A, {
      goal_name: 'Regular',
      goal_start: '2026-01-01',
      goal_end: '2026-12-31',
    });

    const globals = await repo.findAllByUser(USER_A, 'global');
    expect(globals.map((g) => g.id)).toEqual([global.id]);

    const regulars = await repo.findAllByUser(USER_A, 'regular');
    expect(regulars.map((g) => g.id)).toEqual([regular.id]);

    const all = await repo.findAllByUser(USER_A, 'all');
    expect(all.map((g) => g.id).sort()).toEqual([global.id, regular.id].sort());

    const noScope = await repo.findAllByUser(USER_A);
    expect(noScope.map((g) => g.id).sort()).toEqual(
      [global.id, regular.id].sort(),
    );
  });

  it('findByStatus filters by scope', async () => {
    const global = await repo.create(USER_A, {
      goal_name: 'Global',
      is_global: true,
    });
    await repo.create(USER_A, {
      goal_name: 'Regular',
      goal_start: '2026-01-01',
      goal_end: '2026-12-31',
    });

    const activeGlobals = await repo.findByStatus(USER_A, 'active', 'global');
    expect(activeGlobals.map((g) => g.id)).toEqual([global.id]);
  });

  it('does not leak goals across users', async () => {
    await repo.create(USER_A, { goal_name: 'A global', is_global: true });
    await repo.create(USER_B, { goal_name: 'B global', is_global: true });

    const aGoals = await repo.findAllByUser(USER_A, 'all');
    expect(aGoals).toHaveLength(1);
    expect(aGoals[0].goal_name).toBe('A global');
  });

  it('findById embeds children of a global goal', async () => {
    const parent = await repo.create(USER_A, {
      goal_name: 'Parent',
      is_global: true,
    });
    const child = await repo.create(USER_A, {
      goal_name: 'Child',
      goal_start: '2026-01-01',
      goal_end: '2026-12-31',
      parent_goal_id: parent.id,
    });

    const loaded = await repo.findById(parent.id);
    expect(loaded?.children?.map((c) => c.id)).toEqual([child.id]);
  });
});
