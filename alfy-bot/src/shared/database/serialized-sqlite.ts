import { AsyncLocalStorage } from 'node:async_hooks';
import {
  DataSource,
  EntityManager,
  SelectQueryBuilder,
  InsertQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
  RelationQueryBuilder,
} from 'typeorm';
import { SoftDeleteQueryBuilder } from 'typeorm/query-builder/SoftDeleteQueryBuilder';
import type { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions';

type PromiseMethods<T> = {
  [K in keyof T]-?: T[K] extends (...args: any[]) => infer R
    ? 0 extends 1 & R
      ? never
      : R extends Promise<unknown>
        ? K
        : never
    : never;
}[keyof T];

const managerOperations: Record<PromiseMethods<EntityManager>, true> = {
  transaction: true,
  query: true,
  sql: true,
  preload: true,
  save: true,
  remove: true,
  softRemove: true,
  recover: true,
  insert: true,
  upsert: true,
  update: true,
  updateAll: true,
  delete: true,
  deleteAll: true,
  softDelete: true,
  restore: true,
  exists: true,
  existsBy: true,
  count: true,
  countBy: true,
  sum: true,
  average: true,
  minimum: true,
  maximum: true,
  find: true,
  findBy: true,
  findAndCount: true,
  findAndCountBy: true,
  findByIds: true,
  findOne: true,
  findOneBy: true,
  findOneById: true,
  findOneOrFail: true,
  findOneByOrFail: true,
  clear: true,
  increment: true,
  decrement: true,
  release: true,
};

type Builder =
  | SelectQueryBuilder<any>
  | InsertQueryBuilder<any>
  | UpdateQueryBuilder<any>
  | DeleteQueryBuilder<any>
  | SoftDeleteQueryBuilder<any>
  | RelationQueryBuilder<any>;
const selectOperations: Record<
  PromiseMethods<SelectQueryBuilder<any>>,
  true
> = {
  execute: true,
  getRawOne: true,
  getRawMany: true,
  getRawAndEntities: true,
  getOne: true,
  getOneOrFail: true,
  getMany: true,
  getCount: true,
  getExists: true,
  getManyAndCount: true,
  stream: true,
};
const mutationOperations: Record<
  PromiseMethods<InsertQueryBuilder<any>>,
  true
> = { execute: true };
const relationOperations: Record<
  PromiseMethods<RelationQueryBuilder<any>>,
  true
> = {
  execute: true,
  set: true,
  add: true,
  remove: true,
  addAndRemove: true,
  loadOne: true,
  loadMany: true,
};

class SqliteAccess {
  private tail: Promise<unknown> = Promise.resolve();
  private readonly context = new AsyncLocalStorage<{ active: boolean }>();
  private readonly wrapped = new WeakSet<object>();

  run<T>(work: () => Promise<T>): Promise<T> {
    if (this.context.getStore()?.active) return work();
    const operation = this.tail.then(() => {
      const owner = { active: true };
      return this.context.run(owner, async () => {
        try {
          return await work();
        } finally {
          owner.active = false;
        }
      });
    });
    this.tail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  wrapManager(manager: EntityManager): EntityManager {
    if (!this.wrapped.has(manager)) {
      this.wrapped.add(manager);
      this.wrapOperations(manager, Object.keys(managerOperations));
    }
    return manager;
  }

  wrapBuilder<T extends Builder>(builder: T): T {
    if (this.wrapped.has(builder)) return builder;
    this.wrapped.add(builder);
    const operations =
      builder instanceof RelationQueryBuilder
        ? relationOperations
        : builder instanceof SelectQueryBuilder
          ? selectOperations
          : mutationOperations;
    this.wrapOperations(builder, Object.keys(operations));
    for (const name of [
      'select',
      'insert',
      'update',
      'delete',
      'softDelete',
      'restore',
      'relation',
      'clone',
      'subQuery',
    ]) {
      const original: unknown = Reflect.get(builder, name);
      if (typeof original !== 'function') continue;
      Reflect.set(builder, name, (...args: unknown[]) =>
        this.wrapBuilder(
          (original as (...values: unknown[]) => Builder).apply(
            builder,
            args,
          ) as Builder,
        ),
      );
    }
    return builder;
  }

  private wrapOperations(target: object, names: string[]) {
    for (const name of names) {
      const original: unknown = Reflect.get(target, name);
      if (typeof original !== 'function') continue;
      Reflect.set(target, name, (...args: unknown[]) =>
        this.run(
          () =>
            (original as (...values: unknown[]) => Promise<unknown>).apply(
              target,
              args,
            ) as Promise<unknown>,
        ),
      );
    }
  }
}

const coordinators = new WeakMap<DataSource, SqliteAccess>();

/** Создаёт SQLite DataSource с общей очередью операций; вложенные запросы одной операции используют её владение соединением. */
export function createSerializedSqliteDataSource(
  options: SqliteConnectionOptions,
): DataSource {
  const source = new DataSource(options);
  const access = new SqliteAccess();
  coordinators.set(source, access);
  access.wrapManager(source.manager);
  const createManager = source.createEntityManager.bind(
    source,
  ) as DataSource['createEntityManager'];
  source.createEntityManager = (runner) =>
    access.wrapManager(createManager(runner));
  const createBuilder = source.createQueryBuilder.bind(
    source,
  ) as DataSource['createQueryBuilder'];
  source.createQueryBuilder = ((...args: Parameters<typeof createBuilder>) =>
    access.wrapBuilder(
      createBuilder(...args),
    )) as typeof source.createQueryBuilder;
  const query = source.query.bind(source) as DataSource['query'];
  source.query = <T>(...args: Parameters<typeof query>) =>
    access.run(() => query<T>(...args));
  return source;
}

/** Выполняет составную операцию целиком в очереди SQLite, включая raw BEGIN/COMMIT и PRAGMA; ошибка освобождает очередь. */
export function withSqliteAccess<T>(
  source: DataSource,
  work: () => Promise<T>,
): Promise<T> {
  const access = coordinators.get(source);
  if (!access)
    throw new Error(
      'SQLite DataSource must be created with createSerializedSqliteDataSource',
    );
  return access.run(work);
}
