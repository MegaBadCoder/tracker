import { DataSource } from "typeorm";
import * as entities from "../entities";
import { Project, User } from "../entities";
import {
  createSerializedSqliteDataSource,
  withSqliteAccess,
} from "./serialized-sqlite";
import { ScheduleMigrationService } from "./schedule-migration.service";
import { QuestionMigrationService } from "./question-migration.service";

let source: DataSource;
let userId: number;
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(async () => {
  source = createSerializedSqliteDataSource({
    type: "sqlite",
    database: ":memory:",
    entities: Object.values(entities),
    synchronize: true,
  });
  await source.initialize();
  userId = (await source.getRepository(User).save({ username: "sqlite-test" }))
    .id;
});
afterEach(async () => {
  await source.destroy();
});

async function holdRollback() {
  const entered = deferred();
  const gate = deferred();
  const completed = source
    .transaction(async (manager) => {
      await manager.save(Project, { userId, title: "Откат" });
      entered.resolve();
      await gate.promise;
      throw new Error("Откат");
    })
    .catch((error) => error);
  await entered.promise;
  return { release: gate.resolve, completed };
}

it.each(["repository", "builder", "raw"] as const)(
  "запись %s не попадает в чужой rollback",
  async (kind) => {
    const held = await holdRollback();
    const write = () => {
      if (kind === "repository")
        return source
          .getRepository(Project)
          .save({ userId, title: "Сохранено" });
      if (kind === "builder")
        return source
          .createQueryBuilder()
          .insert()
          .into(Project)
          .values({ userId, title: "Сохранено" })
          .execute();
      return source.query(
        "INSERT INTO projects (id, userId, title) VALUES (?, ?, ?)",
        ["raw", userId, "Сохранено"],
      );
    };
    let settled = false;
    const outside = write().then(() => {
      settled = true;
    });
    await tick();
    expect(settled).toBe(false);
    held.release();
    await Promise.all([held.completed, outside]);
    expect(await source.getRepository(Project).find()).toEqual([
      expect.objectContaining({ title: "Сохранено" }),
    ]);
  },
);

it("QueryBuilder не читает незакоммиченные данные другого запроса", async () => {
  const held = await holdRollback();
  const read = source.getRepository(Project).createQueryBuilder("p").getMany();
  held.release();
  await held.completed;
  expect(await read).toEqual([]);
});

it("вложенные обращения разных репозиториев разделяют rollback без deadlock", async () => {
  await expect(
    source.transaction(async (manager) => {
      await manager.save(Project, { userId, title: "A" });
      await source.getRepository(Project).save({ userId, title: "B" });
      await source.manager.transaction(async (nested) => {
        await nested
          .createQueryBuilder()
          .update(Project)
          .set({ title: "C" })
          .execute();
      });
      expect(
        await source.query("SELECT COUNT(*) AS count FROM projects"),
      ).toEqual([{ count: 2 }]);
      throw new Error("Откат");
    }),
  ).rejects.toThrow("Откат");
  expect(await source.getRepository(Project).count()).toBe(0);
});

it("конкурирующие транзакции читают результат предыдущей", async () => {
  const project = await source
    .getRepository(Project)
    .save({ userId, title: "A", order: 0 });
  await Promise.all(
    [1, 2].map(() =>
      source.transaction(async (manager) => {
        const current = await manager.findOneByOrFail(Project, {
          id: project.id,
        });
        await manager.update(Project, project.id, { order: current.order + 1 });
      }),
    ),
  );
  expect(
    (await source.getRepository(Project).findOneByOrFail({ id: project.id }))
      .order,
  ).toBe(2);
});

it("отложенный callback не сохраняет владение завершённой операции", async () => {
  const trigger = deferred();
  let late!: Promise<void>;
  let settled = false;
  await withSqliteAccess(source, async () => {
    late = trigger.promise.then(async () => {
      await source.getRepository(Project).save({ userId, title: "Поздний" });
      settled = true;
    });
  });
  const held = await holdRollback();
  trigger.resolve();
  await tick();
  expect(settled).toBe(false);
  held.release();
  await Promise.all([held.completed, late]);
  expect(await source.getRepository(Project).find()).toEqual([
    expect.objectContaining({ title: "Поздний" }),
  ]);
});

it("параллельные bootstrap-миграции завершают raw-транзакции и восстанавливают foreign_keys", async () => {
  await source.query(
    "CREATE TABLE goal_questions (id integer PRIMARY KEY, goal_id integer, question text, type text, can_skip integer, order_index integer, is_active integer, createdAt datetime)",
  );
  await source.query(
    "CREATE TABLE goal_schedules (id integer PRIMARY KEY, question_id integer UNIQUE, frequency_type text, days_of_week text, interval_days integer, effective_from text, createdAt datetime)",
  );
  await source.query(
    "INSERT INTO goal_questions VALUES (1, NULL, 'Вопрос', 'text', 0, 0, 1, CURRENT_TIMESTAMP)",
  );
  await source.query(
    "INSERT INTO goal_schedules VALUES (1, 1, 'daily', NULL, NULL, NULL, CURRENT_TIMESTAMP)",
  );
  await Promise.all([
    new ScheduleMigrationService(source).onApplicationBootstrap(),
    new QuestionMigrationService(source).onApplicationBootstrap(),
  ]);
  expect(
    await source.query("SELECT question FROM questions WHERE id = 1"),
  ).toEqual([{ question: "Вопрос" }]);
  expect(
    await source.query("SELECT question_id FROM schedules WHERE id = 1"),
  ).toEqual([{ question_id: 1 }]);
  expect(await source.query("PRAGMA foreign_keys")).toEqual([
    { foreign_keys: 1 },
  ]);
});

it("relation QueryBuilder сохраняет связь после чужого rollback", async () => {
  const projects = source.getRepository(Project);
  const parent = await projects.save({ userId, title: "Parent" });
  const child = await projects.save({ userId, title: "Child" });
  const held = await holdRollback();
  let settled = false;
  const outside = source
    .createQueryBuilder()
    .relation(Project, "parent")
    .of(child)
    .set(parent)
    .then(() => {
      settled = true;
    });
  await tick();
  expect(settled).toBe(false);
  held.release();
  await Promise.all([held.completed, outside]);
  expect(
    await source
      .createQueryBuilder()
      .relation(Project, "parent")
      .of(child)
      .loadOne(),
  ).toMatchObject({ id: parent.id });
});
