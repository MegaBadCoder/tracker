import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { Task, TaskDependency } from '../../../shared/entities';
import { withSqliteAccess } from '../../../shared/database/serialized-sqlite';
import {
  TaskDependencyPort,
  TaskDependencyTransaction,
} from '../domain/task-dependency.port';
import type { TaskDependencyEdge } from '../domain/task-dependency';

function readGraph(
  manager: EntityManager,
  userId: number,
): Promise<TaskDependencyEdge[]> {
  return manager
    .getRepository(TaskDependency)
    .createQueryBuilder('edge')
    .innerJoin('edge.task', 'task', 'task.userId = :userId', { userId })
    .innerJoin('edge.dependency', 'dependency', 'dependency.userId = :userId', {
      userId,
    })
    .select(['edge.taskId', 'edge.dependencyId'])
    .orderBy('edge.taskId', 'ASC')
    .addOrderBy('edge.dependencyId', 'ASC')
    .getMany();
}

function transactionAccess(manager: EntityManager): TaskDependencyTransaction {
  return {
    findTasks: (userId, ids) =>
      manager.getRepository(Task).find({
        where: { userId, id: In(ids) },
        select: { id: true, isOverdue: true },
        loadEagerRelations: false,
      }),
    graph: (userId) => readGraph(manager, userId),
    replace: async (taskId, dependencyIds) => {
      await manager.delete(TaskDependency, { taskId });
      if (dependencyIds.length) {
        await manager.insert(
          TaskDependency,
          dependencyIds.map((dependencyId) => ({ taskId, dependencyId })),
        );
      }
    },
  };
}

@Injectable()
export class TypeOrmTaskDependencyRepository extends TaskDependencyPort {
  constructor(@InjectDataSource() private readonly source: DataSource) {
    super();
  }

  graph(userId: number): Promise<TaskDependencyEdge[]> {
    return readGraph(this.source.manager, userId);
  }

  transaction<T>(
    work: (transaction: TaskDependencyTransaction) => Promise<T>,
  ): Promise<T> {
    return withSqliteAccess(this.source, () =>
      this.source.transaction((manager) => work(transactionAccess(manager))),
    );
  }
}
