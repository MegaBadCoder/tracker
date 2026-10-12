import { ConflictException, BadRequestException } from '@nestjs/common';
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
import { TypeOrmProjectColumnRepository } from './typeorm-project-column.repository';

describe('TypeOrmProjectColumnRepository (SQLite)', () => {
  let db: DataSource;
  let repository: TypeOrmProjectColumnRepository;

  beforeEach(async () => {
    db = new DataSource({
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
    await db.initialize();
    await db.getRepository(User).save({ id: 1 });
    await db.getRepository(Project).save([
      { id: 'agile', userId: 1, title: 'Agile', type: 'agile' },
      {
        id: 'simple',
        userId: 1,
        title: 'Simple',
        type: 'simple',
        viewMode: 'board',
      },
      { id: 'other', userId: 1, title: 'Other', type: 'agile' },
    ]);
    await db.getRepository(ProjectColumn).save([
      { id: 'a1', projectId: 'agile', title: 'A1', order: 0 },
      { id: 'a2', projectId: 'agile', title: 'A2', order: 1 },
      { id: 's1', projectId: 'simple', title: 'S1', order: 0 },
      { id: 'o1', projectId: 'other', title: 'O1', order: 0 },
    ]);
    repository = new TypeOrmProjectColumnRepository(
      db.getRepository(ProjectColumn),
    );
  });

  afterEach(async () => db.destroy());

  it.each([false, true])(
    'отклоняет удаление Agile-колонки с задачей completed=%s',
    async (completed) => {
      await db.getRepository(Task).save({
        id: 'task',
        userId: 1,
        title: 'Task',
        projectId: 'agile',
        columnId: 'a1',
        completed,
      });

      await expect(repository.delete('a1', 'agile', true)).rejects.toThrow(
        ConflictException,
      );
      expect(await db.getRepository(ProjectColumn).countBy({ id: 'a1' })).toBe(
        1,
      );
      expect(
        (await db.getRepository(Task).findOneByOrFail({ id: 'task' })).columnId,
      ).toBe('a1');
    },
  );

  it('учитывает задачу закрытого спринта', async () => {
    await db.getRepository(Sprint).save({
      id: 'sprint',
      userId: 1,
      projectId: 'agile',
      name: 'Past',
      status: 'closed',
    });
    await db.getRepository(Task).save({
      id: 'task',
      userId: 1,
      title: 'Task',
      projectId: 'agile',
      columnId: 'a1',
      sprintId: 'sprint',
      completed: true,
    });

    await expect(repository.delete('a1', 'agile', true)).rejects.toThrow(
      ConflictException,
    );
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: 'task' })).columnId,
    ).toBe('a1');
  });

  it('подсказывает перенести задачи при отказе удаления', async () => {
    await db.getRepository(Task).save({
      id: 'task',
      userId: 1,
      title: 'Task',
      projectId: 'agile',
      columnId: 'a1',
    });

    await expect(repository.delete('a1', 'agile', true)).rejects.toThrow(
      'Сначала перенесите задачи в другую колонку.',
    );
  });

  it('удаляет пустую Agile-колонку', async () => {
    await expect(repository.delete('a1', 'agile', true)).resolves.toBe(true);
    expect(await db.getRepository(ProjectColumn).countBy({ id: 'a1' })).toBe(0);
  });

  it('сохраняет прежнее удаление занятой колонки простой доски', async () => {
    await db.getRepository(Task).save({
      id: 'task',
      userId: 1,
      title: 'Task',
      projectId: 'simple',
      columnId: 's1',
    });

    await expect(repository.delete('s1', 'simple', false)).resolves.toBe(true);
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: 'task' })).columnId,
    ).toBeNull();
  });

  it('отклоняет чужой ID без частичной перестановки', async () => {
    await expect(
      repository.reorder('agile', [
        { id: 'a2', order: 0 },
        { id: 'o1', order: 1 },
      ]),
    ).rejects.toThrow(BadRequestException);
    expect((await repository.findById('a1', 'agile'))?.order).toBe(0);
    expect((await repository.findById('a2', 'agile'))?.order).toBe(1);
    expect((await repository.findById('o1', 'other'))?.order).toBe(0);
  });

  it('требует полный список без повторов', async () => {
    await expect(
      repository.reorder('agile', [{ id: 'a1', order: 0 }]),
    ).rejects.toThrow(BadRequestException);
    await expect(
      repository.reorder('agile', [
        { id: 'a1', order: 0 },
        { id: 'a1', order: 1 },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('переставляет все колонки только указанного проекта', async () => {
    await repository.reorder('agile', [
      { id: 'a2', order: 0 },
      { id: 'a1', order: 1 },
    ]);
    expect(
      (await repository.findAllByProject('agile')).map((c) => c.id),
    ).toEqual(['a2', 'a1']);
    expect((await repository.findById('o1', 'other'))?.order).toBe(0);
  });
});
