import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskDependencyService } from './task-dependency.service';
import {
  TaskDependencyPort,
  TaskDependencyTransaction,
} from './domain/task-dependency.port';

function mocks() {
  const tx = {
    findTasks: jest
      .fn<
        ReturnType<TaskDependencyTransaction['findTasks']>,
        Parameters<TaskDependencyTransaction['findTasks']>
      >()
      .mockResolvedValue([
        { id: 'a', isOverdue: false },
        { id: 'b', isOverdue: false },
      ]),
    graph: jest
      .fn<
        ReturnType<TaskDependencyTransaction['graph']>,
        Parameters<TaskDependencyTransaction['graph']>
      >()
      .mockResolvedValue([]),
    replace: jest
      .fn<Promise<void>, [string, string[]]>()
      .mockResolvedValue(undefined),
  };
  const repository = {
    graph: jest
      .fn<ReturnType<TaskDependencyTransaction['graph']>, [number]>()
      .mockResolvedValue([]),
    transaction: jest.fn(
      <T>(work: (transaction: TaskDependencyTransaction) => Promise<T>) =>
        work(tx),
    ),
  };
  return { tx, repository };
}

describe('TaskDependencyService', () => {
  let service: TaskDependencyService;
  let tx: ReturnType<typeof mocks>['tx'];
  let repository: ReturnType<typeof mocks>['repository'];

  beforeEach(() => {
    ({ tx, repository } = mocks());
    service = new TaskDependencyService(repository as TaskDependencyPort);
  });

  it('validates and replaces inside one transaction', async () => {
    await expect(service.replace(1, 'a', ['b'])).resolves.toEqual({
      taskId: 'a',
      dependencyIds: ['b'],
    });
    expect(repository.transaction).toHaveBeenCalledTimes(1);
    expect(tx.findTasks).toHaveBeenCalledWith(1, ['a', 'b']);
    expect(tx.graph).toHaveBeenCalledWith(1);
    expect(tx.replace).toHaveBeenCalledWith('a', ['b']);
  });

  it('queries the graph without opening a write transaction', async () => {
    await service.graph(1);
    expect(repository.graph).toHaveBeenCalledWith(1);
    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it.each([['a'], ['b', 'b']])(
    'rejects invalid predecessor set %j',
    async (...ids) => {
      await expect(service.replace(1, 'a', ids)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tx.replace).not.toHaveBeenCalled();
    },
  );

  it('hides missing or foreign source', async () => {
    tx.findTasks.mockResolvedValue([{ id: 'b', isOverdue: false }]);
    await expect(service.replace(1, 'a', ['b'])).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.replace).not.toHaveBeenCalled();
  });

  it('hides missing or foreign predecessor', async () => {
    tx.findTasks.mockResolvedValue([{ id: 'a', isOverdue: false }]);
    await expect(service.replace(1, 'a', ['b'])).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.replace).not.toHaveBeenCalled();
  });

  it('rejects mutation of a frozen task', async () => {
    tx.findTasks.mockResolvedValue([{ id: 'a', isOverdue: true }]);
    await expect(service.replace(1, 'a', [])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.replace).not.toHaveBeenCalled();
  });

  it('rejects a cycle before deleting old edges', async () => {
    tx.graph.mockResolvedValue([{ taskId: 'b', dependencyId: 'a' }]);
    await expect(service.replace(1, 'a', ['b'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.replace).not.toHaveBeenCalled();
  });
});
