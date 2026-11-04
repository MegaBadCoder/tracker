import { DataSource } from 'typeorm';
import * as entities from '../../../shared/entities';
import { BoardGroup, Project, Sprint, User } from '../../../shared/entities';
import { TypeOrmBoardGroupRepository } from './typeorm-board-group.repository';

describe('Метаданные историй и конкурентное планирование', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: Object.values(entities),
      synchronize: true,
    }).initialize();
    await dataSource.getRepository(User).save({ id: 1 });
    await dataSource
      .getRepository(Project)
      .save({ id: 'project', userId: 1, title: 'Проект', type: 'agile' });
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('сохранение статуса не возвращает историю в старый спринт и порядок', async () => {
    const groups = dataSource.getRepository(BoardGroup);
    const repository = new TypeOrmBoardGroupRepository(groups);
    const epic = await groups.save({
      userId: 1,
      projectId: 'project',
      title: 'Эпик',
      type: 'epic',
    });
    const story = await groups.save({
      userId: 1,
      projectId: 'project',
      title: 'История',
      parentId: epic.id,
      type: 'story',
      workflowStatusId: 'open',
    });
    const stale = await repository.findById(story.id, 'project');
    const sprint = await dataSource
      .getRepository(Sprint)
      .save({ userId: 1, projectId: 'project', name: 'Следующий' });
    await groups.update(story.id, { sprintId: sprint.id, order: 3 });
    const updated = await repository.save({
      ...stale!,
      workflowStatusId: 'in_progress',
    });
    expect(updated).toMatchObject({
      sprintId: sprint.id,
      order: 3,
      workflowStatusId: 'in_progress',
    });
    expect(await repository.findById(story.id, 'project')).toMatchObject({
      sprintId: sprint.id,
      order: 3,
      workflowStatusId: 'in_progress',
    });
  });
});
