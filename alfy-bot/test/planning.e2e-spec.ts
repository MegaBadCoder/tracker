import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initializeWithSchemaSync } from "../src/shared/database/create-data-source";
import {
  SprintHistoryService,
  SPRINT_HISTORY_TRIGGER_NAMES,
} from "../src/shared/database/sprint-history.service";
import { BoardGroupConstraintsMigrationService } from "../src/shared/database/board-group-constraints.service";
import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import { createTestApp } from "./helpers/test-app";
import { JwtService } from "@nestjs/jwt";
import {
  Task,
  Sprint,
  PomodoroConfig,
  User,
  BoardGroup,
} from "../src/shared/entities";

describe("Планирование и история спринта (SQLite HTTP)", () => {
  let app: INestApplication;
  let token: string;
  let userId: number;
  let db: DataSource;
  let projectId: string;
  const api = () => request(app.getHttpServer());
  const auth = () => `Bearer ${token}`;
  const url = () => `/api/projects/${projectId}`;
  const post = (path: string, body: object) =>
    api().post(path).set("Authorization", auth()).send(body);
  const get = (path: string) => api().get(path).set("Authorization", auth());
  const patch = (path: string, body: object) =>
    api().patch(path).set("Authorization", auth()).send(body);
  const sprint = async (body: object = {}) =>
    (await post(`${url()}/sprints`, body).expect(201)).body;
  const task = async (body: object = {}) =>
    (
      await post("/api/tasks", { title: "Задача", projectId, ...body }).expect(
        201,
      )
    ).body;

  beforeAll(async () => {
    ({ app, token, userId } = await createTestApp());
    db = app.get(DataSource);
    await app.listen(0);
  });
  beforeEach(async () => {
    projectId = (
      await post("/api/projects", {
        title: "Планирование",
        type: "agile",
      }).expect(201)
    ).body.id;
  });
  afterAll(async () => {
    await app.close();
  });

  it("сохраняет бюджет, не удваивает оценки и показывает неизвестные", async () => {
    const s = await sprint({ capacityMinutes: 120, reserveMinutes: 20 });
    const a = await task({ sprintId: s.id, durationMinutes: 40 });
    const b = await task({ sprintId: s.id });
    await task({ sprintId: s.id });
    await db.getRepository(PomodoroConfig).save([
      { taskId: a.id, pomodoroCount: 4, pomodoroDuration: 25 },
      { taskId: b.id, pomodoroCount: 2, pomodoroDuration: 25 },
    ]);
    const { body } = await get(`${url()}/planning?sprintId=${s.id}`).expect(
      200,
    );
    expect(body).toMatchObject({
      capacityMinutes: 120,
      reserveMinutes: 20,
      plannedMinutes: 90,
      remainingMinutes: 10,
      unestimatedCount: 1,
    });
    await patch(`${url()}/sprints/${s.id}`, { reserveMinutes: 121 }).expect(
      400,
    );
    await patch(`${url()}/sprints/${s.id}`, { reserveMinutes: null }).expect(
      400,
    );
  });

  it("фиксирует исходный план, изменения обычного PATCH и итог до переноса", async () => {
    const s = await sprint();
    const a = await task({
      title: "Начальная",
      sprintId: s.id,
      durationMinutes: 50,
    });
    const carried = await task({ title: "Перенос", sprintId: s.id });
    await post(`${url()}/sprints/${s.id}/start`, {
      startDate: "2026-11-04",
      endDate: "2026-11-10",
    }).expect(201);
    await patch(`/api/tasks/${a.id}`, { completed: true }).expect(200);
    const added = await task({ title: "Срочная", sprintId: s.id });
    await patch(`/api/tasks/${added.id}`, { sprintId: null }).expect(200);
    await post(`${url()}/sprints/${s.id}/complete`, {
      moveTo: "backlog",
      goalOutcome: "partial",
      improvement: "Меньше задач",
      carryoverReason: "Не хватило времени",
    }).expect(201);
    await patch(`/api/tasks/${carried.id}`, { title: "Переименована" }).expect(
      200,
    );
    const { body } = await get(`${url()}/sprints/${s.id}/report`).expect(200);
    expect(body.historyComplete).toBe(true);
    expect(body.initial.tasks).toHaveLength(2);
    expect(
      body.final.tasks.find((t: { id: string }) => t.id === carried.id).title,
    ).toBe("Перенос");
    expect(body.summary).toEqual({
      planned: 2,
      added: 1,
      removed: 1,
      completed: 1,
      carried: 1,
    });
    expect(body.retrospective).toMatchObject({
      goalOutcome: "partial",
      improvement: "Меньше задач",
    });
    expect(body.events.map((e: { kind: string }) => e.kind)).toEqual(
      expect.arrayContaining(["completed", "added", "removed"]),
    );
  });

  it("массовый перенос атомарен и undo обнаруживает более новые правки", async () => {
    const s = await sprint();
    const a = await task();
    const b = await task();
    const { body } = await post(`${url()}/planning/move`, {
      taskIds: [a.id, b.id],
      storyIds: [],
      sprintId: s.id,
    }).expect(201);
    expect(body.updated).toBe(2);
    await patch(`/api/tasks/${a.id}`, {
      title: "Изменение после переноса",
    }).expect(200);
    await post(`${url()}/planning/undo`, { undoToken: body.undoToken }).expect(
      409,
    );
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: b.id })).sprintId,
    ).toBe(s.id);
    await post(`${url()}/planning/move`, {
      taskIds: [a.id, "00000000-0000-4000-8000-000000000000"],
      storyIds: [],
      sprintId: null,
    }).expect(400);
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: a.id })).sprintId,
    ).toBe(s.id);
  });

  it("undo одноразовый и восстанавливает исходное назначение", async () => {
    const s = await sprint();
    const a = await task();
    const { body } = await post(`${url()}/planning/move`, {
      taskIds: [a.id],
      storyIds: [],
      sprintId: s.id,
    }).expect(201);
    await post(`${url()}/planning/undo`, { undoToken: body.undoToken }).expect(
      201,
    );
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: a.id })).sprintId,
    ).toBeNull();
    await post(`${url()}/planning/undo`, { undoToken: body.undoToken }).expect(
      409,
    );
  });

  it("предложение не меняет данные и укладывается в явный бюджет", async () => {
    const s = await sprint();
    const a = await task({ title: "Оплата картой", durationMinutes: 30 });
    await task({ title: "Другая задача", durationMinutes: 80 });
    const unknown = await task({ title: "Не оценена" });
    const { body } = await post(`${url()}/planning/proposal`, {
      sprintId: s.id,
      budgetMinutes: 60,
      goal: "Оплата",
    }).expect(201);
    expect(body.taskIds).toContain(a.id);
    expect(body.totalMinutes).toBe(30);
    expect(body.unestimatedIds).toContain(unknown.id);
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: a.id })).sprintId,
    ).toBeNull();
  });

  it("выполнение задачи не освобождает бюджет всего спринта", async () => {
    const s = await sprint({ capacityMinutes: 60 });
    const a = await task({ sprintId: s.id, durationMinutes: 40 });
    const b = await task({ title: "Новая работа", durationMinutes: 30 });
    await patch(`/api/tasks/${a.id}`, { completed: true }).expect(200);
    const { body: context } = await get(
      `${url()}/planning?sprintId=${s.id}`,
    ).expect(200);
    expect(context.plannedMinutes).toBe(40);
    expect(context.remainingMinutes).toBe(20);
    const { body: proposal } = await post(`${url()}/planning/proposal`, {
      sprintId: s.id,
      budgetMinutes: 60,
      goal: "",
    }).expect(201);
    expect(proposal.taskIds).not.toContain(b.id);
    expect(proposal.totalMinutes).toBe(40);
  });

  it("старый закрытый спринт не получает выдуманную историю", async () => {
    const s = await db
      .getRepository(Sprint)
      .save({ projectId, userId, name: "Старый", status: "closed" });
    const { body } = await get(`${url()}/sprints/${s.id}/report`).expect(200);
    expect(body.historyComplete).toBe(false);
    expect(body.initial).toBeNull();
    expect(body.final).toBeNull();
  });
  it("изолирует проекты и пользователей во всех командах", async () => {
    const s = await sprint();
    const a = await task();
    const otherProject = (
      await post("/api/projects", { title: "Другой", type: "agile" }).expect(
        201,
      )
    ).body.id;
    const foreignTask = (
      await post("/api/tasks", {
        title: "Чужая проекту",
        projectId: otherProject,
      }).expect(201)
    ).body;
    const otherUser = await db.getRepository(User).save({ username: "other" });
    const otherToken = app.get(JwtService).sign({ sub: otherUser.id });
    const move = { taskIds: [a.id], storyIds: [], sprintId: s.id };
    await api()
      .post(`${url()}/planning/move`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send(move)
      .expect(404);
    await api()
      .get(`${url()}/planning`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(404);
    await api()
      .get(`${url()}/sprints/${s.id}/report`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(404);
    await post(`${url()}/planning/move`, {
      ...move,
      taskIds: [a.id, foreignTask.id],
    }).expect(400);
    await patch(`${url()}/planning/order`, {
      taskIds: [foreignTask.id],
      sprintId: null,
    }).expect(400);
    const { body } = await post(`${url()}/planning/move`, move).expect(201);
    await post(`/api/projects/${otherProject}/planning/undo`, {
      undoToken: body.undoToken,
    }).expect(409);
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: a.id })).sprintId,
    ).toBe(s.id);
    await api()
      .patch(`${url()}/planning/order`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ taskIds: [a.id], sprintId: s.id })
      .expect(404);
    await api()
      .post(`${url()}/planning/undo`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ undoToken: body.undoToken })
      .expect(404);
  });

  it("выборочное закрытие проверяет все назначения до записи и сохраняет результат", async () => {
    const s = await sprint();
    const next = await sprint();
    const a = await task({ sprintId: s.id });
    const b = await task({ sprintId: s.id });
    await post(`${url()}/sprints/${s.id}/start`, {
      startDate: "2026-11-04",
      endDate: "2026-11-10",
    }).expect(201);
    const foreignProject = (
      await post("/api/projects", { title: "Другой", type: "agile" }).expect(
        201,
      )
    ).body.id;
    const foreign = (
      await post(`/api/projects/${foreignProject}/sprints`, {}).expect(201)
    ).body;
    await post(`${url()}/sprints/${s.id}/complete`, {
      moveTo: "backlog",
      taskDestinations: [
        { taskId: a.id, sprintId: next.id },
        { taskId: b.id, sprintId: foreign.id },
      ],
    }).expect(400);
    expect(
      (await db.getRepository(Sprint).findOneByOrFail({ id: s.id })).status,
    ).toBe("active");
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: a.id })).sprintId,
    ).toBe(s.id);
    await post(`${url()}/sprints/${s.id}/complete`, {
      moveTo: "backlog",
      taskDestinations: [{ taskId: a.id, sprintId: next.id }],
    }).expect(201);
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: a.id })).sprintId,
    ).toBe(next.id);
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: b.id })).sprintId,
    ).toBeNull();
    const { body } = await get(`${url()}/sprints/${s.id}/report`).expect(200);
    expect(body.final.tasks).toHaveLength(2);
    await post(`${url()}/planning/move`, {
      taskIds: [a.id],
      storyIds: [],
      sprintId: s.id,
    }).expect(400);
  });

  it("предложение учитывает готовность, отложенные, архив, оценки и стоимость зависимостей", async () => {
    const s = await sprint();
    const epic = (await post(`${url()}/groups`, { title: "Эпик" }).expect(201))
      .body;
    const makeStory = async (
      title: string,
      minutes: number | null,
      metadata: object,
    ) => {
      const story = (
        await post(`${url()}/groups`, { title, parentId: epic.id }).expect(201)
      ).body;
      await patch(`${url()}/groups/${story.id}`, {
        workflowStatusId: "ready",
        ...metadata,
      }).expect(200);
      const t = await task({
        title,
        groupId: story.id,
        ...(minutes ? { durationMinutes: minutes } : {}),
      });
      return { story, task: t };
    };
    const dependency = await makeStory("База", 40, {});
    const desired = await makeStory("Оплата", 30, {
      dependencyIds: [dependency.story.id],
    });
    const archive = await makeStory("Архив", 5, { archived: true });
    const deferred = await makeStory("Позже", 5, {
      deferredUntil: "2099-01-01",
    });
    const draft = await makeStory("Идея", 5, { workflowStatusId: "open" });
    const blocked = await makeStory("Блокер", 5, {
      blockedReason: "Ждём доступ",
    });
    const unknown = await makeStory("Без оценки", null, {});
    const small = (
      await post(`${url()}/planning/proposal`, {
        sprintId: s.id,
        budgetMinutes: 60,
        goal: "Оплата",
      }).expect(201)
    ).body;
    expect(small.storyIds).not.toContain(desired.story.id);
    for (const item of [archive, deferred, draft, blocked, unknown])
      expect(small.storyIds).not.toContain(item.story.id);
    expect(small.unestimatedIds).toContain(unknown.task.id);
    const large = (
      await post(`${url()}/planning/proposal`, {
        sprintId: s.id,
        budgetMinutes: 70,
        goal: "Оплата",
      }).expect(201)
    ).body;
    expect(large.storyIds).toEqual(
      expect.arrayContaining([dependency.story.id, desired.story.id]),
    );
    expect(large.totalMinutes).toBe(70);
    const move = await post(`${url()}/planning/move`, {
      taskIds: large.taskIds,
      storyIds: large.storyIds,
      sprintId: s.id,
    }).expect(201);
    expect(move.body.updated).toBe(2);
    expect(
      (
        await db
          .getRepository(BoardGroup)
          .findOneByOrFail({ id: desired.story.id })
      ).workflowStatusId,
    ).toBe("ready");
  });

  it("массовый перенос истории сохраняет статус и undo замечает новую дочернюю задачу", async () => {
    const s = await sprint();
    const epic = (await post(`${url()}/groups`, { title: "Эпик" }).expect(201))
      .body;
    const story = (
      await post(`${url()}/groups`, {
        title: "История",
        parentId: epic.id,
      }).expect(201)
    ).body;
    await patch(`${url()}/groups/${story.id}`, {
      workflowStatusId: "in_progress",
      blockedReason: "Доступ",
    }).expect(200);
    await task({ groupId: story.id });
    const { body } = await post(`${url()}/planning/move`, {
      taskIds: [],
      storyIds: [story.id],
      sprintId: s.id,
    }).expect(201);
    expect(
      (await db.getRepository(BoardGroup).findOneByOrFail({ id: story.id }))
        .workflowStatusId,
    ).toBe("in_progress");
    await task({ groupId: story.id });
    await post(`${url()}/planning/undo`, { undoToken: body.undoToken }).expect(
      409,
    );
    expect(
      (await db.getRepository(BoardGroup).findOneByOrFail({ id: story.id }))
        .sprintId,
    ).toBe(s.id);
  });

  it("bulk защищает закрытый источник, legacy перенос сохраняет снимок истории", async () => {
    const s = await sprint();
    const epic = (await post(`${url()}/groups`, { title: "Эпик" }).expect(201))
      .body;
    const story = (
      await post(`${url()}/groups`, {
        title: "История",
        parentId: epic.id,
      }).expect(201)
    ).body;
    await patch(`${url()}/groups/${story.id}/sprint`, {
      sprintId: s.id,
    }).expect(200);
    await patch(`${url()}/groups/${story.id}`, { status: "done" }).expect(200);
    await post(`${url()}/sprints/${s.id}/start`, {
      startDate: "2026-11-04",
      endDate: "2026-11-10",
    }).expect(201);
    await post(`${url()}/sprints/${s.id}/complete`, {
      moveTo: "backlog",
    }).expect(201);
    await post(`${url()}/planning/move`, {
      taskIds: [],
      storyIds: [story.id],
      sprintId: null,
    }).expect(400);
    await patch(`${url()}/groups/${story.id}/sprint`, {
      sprintId: null,
    }).expect(200);
    const report = (await get(`${url()}/sprints/${s.id}/report`).expect(200))
      .body;
    expect(report.final.stories).toContainEqual(
      expect.objectContaining({ id: story.id, status: "done" }),
    );
  });

  it("предложение и перенос истории выбирают только незавершённые задачи, отмена сохраняет выполненные", async () => {
    const s = await sprint();
    const other = await sprint();
    const epic = (await post(`${url()}/groups`, { title: "Эпик" }).expect(201))
      .body;
    const story = (
      await post(`${url()}/groups`, {
        title: "История",
        parentId: epic.id,
      }).expect(201)
    ).body;
    await patch(`${url()}/groups/${story.id}`, {
      workflowStatusId: "ready",
    }).expect(200);
    const done = await task({ groupId: story.id, durationMinutes: 90 });
    const unknownDone = await task({ groupId: story.id });
    const otherDone = await task({
      groupId: story.id,
      sprintId: other.id,
      durationMinutes: 90,
    });
    for (const t of [done, unknownDone, otherDone]) {
      await patch(`/api/tasks/${t.id}`, { completed: true }).expect(200);
    }
    const open = await task({ groupId: story.id, durationMinutes: 10 });
    const { body: proposal } = await post(`${url()}/planning/proposal`, {
      sprintId: s.id,
      budgetMinutes: 10,
      goal: "",
    }).expect(201);
    expect(proposal.storyIds).toEqual([story.id]);
    expect(proposal.taskIds).toEqual([]);
    expect(proposal.totalMinutes).toBe(10);
    expect(proposal.unestimatedIds).not.toContain(unknownDone.id);
    const { body: move } = await post(`${url()}/planning/move`, {
      sprintId: s.id,
      taskIds: proposal.taskIds,
      storyIds: proposal.storyIds,
    }).expect(201);
    expect(move.updated).toBe(1);
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: open.id })).sprintId,
    ).toBe(s.id);
    for (const t of [done, unknownDone]) {
      expect(
        (await db.getRepository(Task).findOneByOrFail({ id: t.id })).sprintId,
      ).toBeNull();
    }
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: otherDone.id }))
        .sprintId,
    ).toBe(other.id);
    await post(`${url()}/planning/undo`, { undoToken: move.undoToken }).expect(
      201,
    );
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: open.id })).sprintId,
    ).toBeNull();
    expect(
      (await db.getRepository(BoardGroup).findOneByOrFail({ id: story.id }))
        .sprintId,
    ).toBeNull();
    expect(
      await db.getRepository(Task).findOneByOrFail({ id: done.id }),
    ).toMatchObject({ completed: true, sprintId: null });
    expect(
      await db.getRepository(Task).findOneByOrFail({ id: unknownDone.id }),
    ).toMatchObject({ completed: true, sprintId: null });
    expect(
      await db.getRepository(Task).findOneByOrFail({ id: otherDone.id }),
    ).toMatchObject({ completed: true, sprintId: other.id });
  });

  it("выполненная задача истории в целевом спринте остаётся в бюджете предложения", async () => {
    const s = await sprint();
    const epic = (await post(`${url()}/groups`, { title: "Эпик" }).expect(201))
      .body;
    const story = (
      await post(`${url()}/groups`, {
        title: "История",
        parentId: epic.id,
      }).expect(201)
    ).body;
    await patch(`${url()}/groups/${story.id}`, {
      workflowStatusId: "ready",
    }).expect(200);
    const done = await task({
      groupId: story.id,
      sprintId: s.id,
      durationMinutes: 90,
    });
    await patch(`/api/tasks/${done.id}`, { completed: true }).expect(200);
    await task({ groupId: story.id, durationMinutes: 10 });
    const { body: full } = await post(`${url()}/planning/proposal`, {
      sprintId: s.id,
      budgetMinutes: 90,
      goal: "",
    }).expect(201);
    expect(full.totalMinutes).toBe(90);
    expect(full.storyIds).toEqual([]);
    const { body: available } = await post(`${url()}/planning/proposal`, {
      sprintId: s.id,
      budgetMinutes: 100,
      goal: "",
    }).expect(201);
    expect(available.totalMinutes).toBe(100);
    expect(available.storyIds).toEqual([story.id]);
    const { body: move } = await post(`${url()}/planning/move`, {
      sprintId: s.id,
      taskIds: available.taskIds,
      storyIds: available.storyIds,
    }).expect(201);
    expect(move.updated).toBe(1);
    await post(`${url()}/planning/undo`, { undoToken: move.undoToken }).expect(
      201,
    );
    expect(
      await db.getRepository(Task).findOneByOrFail({ id: done.id }),
    ).toMatchObject({ completed: true, sprintId: s.id });
  });

  it("задача, выполненная после предложения, остаётся на месте при переносе истории", async () => {
    const s = await sprint();
    const epic = (await post(`${url()}/groups`, { title: "Эпик" }).expect(201))
      .body;
    const story = (
      await post(`${url()}/groups`, {
        title: "История",
        parentId: epic.id,
      }).expect(201)
    ).body;
    await patch(`${url()}/groups/${story.id}`, {
      workflowStatusId: "ready",
    }).expect(200);
    const t = await task({ groupId: story.id, durationMinutes: 10 });
    const { body: proposal } = await post(`${url()}/planning/proposal`, {
      sprintId: s.id,
      budgetMinutes: 10,
      goal: "",
    }).expect(201);
    expect(proposal.storyIds).toEqual([story.id]);
    await patch(`/api/tasks/${t.id}`, { completed: true }).expect(200);
    const { body: move } = await post(`${url()}/planning/move`, {
      sprintId: s.id,
      taskIds: proposal.taskIds,
      storyIds: proposal.storyIds,
    }).expect(201);
    expect(move.updated).toBe(0);
    expect(
      await db.getRepository(Task).findOneByOrFail({ id: t.id }),
    ).toMatchObject({ completed: true, sprintId: null });
    expect(
      (await db.getRepository(BoardGroup).findOneByOrFail({ id: story.id }))
        .sprintId,
    ).toBe(s.id);
    await post(`${url()}/planning/undo`, { undoToken: move.undoToken }).expect(
      201,
    );
    expect(
      (await db.getRepository(BoardGroup).findOneByOrFail({ id: story.id }))
        .sprintId,
    ).toBeNull();
    expect(
      await db.getRepository(Task).findOneByOrFail({ id: t.id }),
    ).toMatchObject({ completed: true, sprintId: null });
  });

  it("явный выбор выполненной задачи разрешает её перенос и отмену", async () => {
    const s = await sprint();
    const t = await task({ durationMinutes: 90 });
    await patch(`/api/tasks/${t.id}`, { completed: true }).expect(200);
    const { body: move } = await post(`${url()}/planning/move`, {
      sprintId: s.id,
      taskIds: [t.id],
      storyIds: [],
    }).expect(201);
    expect(move.updated).toBe(1);
    expect(
      await db.getRepository(Task).findOneByOrFail({ id: t.id }),
    ).toMatchObject({ completed: true, sprintId: s.id });
    await post(`${url()}/planning/undo`, { undoToken: move.undoToken }).expect(
      201,
    );
    expect(
      await db.getRepository(Task).findOneByOrFail({ id: t.id }),
    ).toMatchObject({ completed: true, sprintId: null });
  });

  it("повторные переносы в отчёте сохраняют баланс состава", async () => {
    const s = await sprint();
    const a = await task({ sprintId: s.id });
    await post(`${url()}/sprints/${s.id}/start`, {
      startDate: "2026-11-04",
      endDate: "2026-11-10",
    }).expect(201);
    await patch(`/api/tasks/${a.id}`, { sprintId: null }).expect(200);
    await patch(`/api/tasks/${a.id}`, { sprintId: s.id }).expect(200);
    await patch(`/api/tasks/${a.id}`, { sprintId: null }).expect(200);
    const { body } = await get(`${url()}/sprints/${s.id}/report`).expect(200);
    expect(body.summary).toMatchObject({ planned: 1, added: 1, removed: 2 });
  });

  it("ошибка массового переноса не откатывает параллельный обычный PATCH", async () => {
    const s = await sprint();
    const a = await task();
    const b = await task();
    const unrelated = await task();
    await db.query(
      `CREATE TRIGGER test_planning_failure BEFORE UPDATE OF sprintId ON tasks WHEN NEW.id = '${b.id}' BEGIN SELECT RAISE(ABORT, 'injected planning failure'); END;`,
    );
    const [move, edit] = await Promise.all([
      post(`${url()}/planning/move`, {
        taskIds: [a.id, b.id],
        storyIds: [],
        sprintId: s.id,
      }),
      patch(`/api/tasks/${unrelated.id}`, { title: "Сохранённая правка" }),
    ]);
    await db.query("DROP TRIGGER test_planning_failure");
    expect(move.status).toBe(500);
    expect(edit.status).toBe(200);
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: a.id })).sprintId,
    ).toBeNull();
    expect(
      (await db.getRepository(Task).findOneByOrFail({ id: unrelated.id }))
        .title,
    ).toBe("Сохранённая правка");
  });

  it("после пересборки схемы и повторного старта история продолжает фиксироваться", async () => {
    const directory = await mkdtemp(join(tmpdir(), "alfy-planning-"));
    const options = {
      ...db.options,
      type: "sqlite" as const,
      database: join(directory, "history.sqlite"),
    };
    let source: DataSource | null = null;
    try {
      source = await initializeWithSchemaSync(options);
      await new BoardGroupConstraintsMigrationService(
        source,
      ).onApplicationBootstrap();
      await new SprintHistoryService(source).onApplicationBootstrap();
      await source.query(
        "ALTER TABLE tasks ADD COLUMN obsoletePlanningField TEXT",
      );
      await source.destroy();
      source = await initializeWithSchemaSync(options);
      await new BoardGroupConstraintsMigrationService(
        source,
      ).onApplicationBootstrap();
      await new SprintHistoryService(source).onApplicationBootstrap();
      const rows: { name: string }[] = await source.query(
        "SELECT name FROM sqlite_master WHERE type = 'trigger'",
      );
      expect(rows.map((row) => row.name)).toEqual(
        expect.arrayContaining(SPRINT_HISTORY_TRIGGER_NAMES),
      );
      const user = await source
        .getRepository(User)
        .save({ username: "restart" });
      const project = await source
        .getRepository("Project")
        .save({ userId: user.id, title: "Restart", type: "agile" });
      const started = await source.getRepository(Sprint).save({
        userId: user.id,
        projectId: project.id,
        name: "Restart",
        status: "active",
      });
      await source.getRepository(Task).save({
        userId: user.id,
        projectId: project.id,
        sprintId: started.id,
        title: "После старта",
      });
      const events: { kind: string }[] = await source.query(
        "SELECT kind FROM sprint_events WHERE sprintId = ?",
        [started.id],
      );
      expect(events).toEqual([{ kind: "added" }]);
    } finally {
      if (source?.isInitialized) await source.destroy();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("назначенная в спринт заблокированная зависимость не считается готовой", async () => {
    const s = await sprint();
    const epic = (await post(`${url()}/groups`, { title: "Эпик" }).expect(201))
      .body;
    const first = (
      await post(`${url()}/groups`, {
        title: "База",
        parentId: epic.id,
      }).expect(201)
    ).body;
    const second = (
      await post(`${url()}/groups`, {
        title: "Продолжение",
        parentId: epic.id,
      }).expect(201)
    ).body;
    await patch(`${url()}/groups/${first.id}`, {
      workflowStatusId: "ready",
      blockedReason: "Нет доступа",
    }).expect(200);
    await patch(`${url()}/groups/${second.id}`, {
      workflowStatusId: "ready",
      dependencyIds: [first.id],
    }).expect(200);
    await task({ groupId: first.id, durationMinutes: 10 });
    await task({ groupId: second.id, durationMinutes: 10 });
    await patch(`${url()}/groups/${first.id}/sprint`, {
      sprintId: s.id,
    }).expect(200);
    const { body } = await post(`${url()}/planning/proposal`, {
      sprintId: s.id,
      budgetMinutes: 100,
      goal: "",
    }).expect(201);
    expect(body.storyIds).not.toContain(second.id);
    expect(body.excluded).toContainEqual({
      id: second.id,
      reason: expect.stringContaining("Нет доступа"),
    });
  });

  it("проверяет транзитивный блокер уже выбранной зависимости", async () => {
    const s = await sprint();
    const epic = (await post(`${url()}/groups`, { title: "Эпик" }).expect(201))
      .body;
    const make = async (title: string) => {
      const story = (
        await post(`${url()}/groups`, { title, parentId: epic.id }).expect(201)
      ).body;
      await patch(`${url()}/groups/${story.id}`, {
        workflowStatusId: "ready",
      }).expect(200);
      await task({ groupId: story.id, durationMinutes: 10 });
      return story;
    };
    const base = await make("База");
    const selected = await make("Уже выбрана");
    const candidate = await make("Следующая");
    await patch(`${url()}/groups/${base.id}`, {
      blockedReason: "Нет доступа",
    }).expect(200);
    await patch(`${url()}/groups/${selected.id}`, {
      dependencyIds: [base.id],
    }).expect(200);
    await patch(`${url()}/groups/${selected.id}/sprint`, {
      sprintId: s.id,
    }).expect(200);
    await patch(`${url()}/groups/${candidate.id}`, {
      dependencyIds: [selected.id],
    }).expect(200);
    const { body } = await post(`${url()}/planning/proposal`, {
      sprintId: s.id,
      budgetMinutes: 100,
      goal: "",
    }).expect(201);
    expect(body.storyIds).not.toContain(candidate.id);
  });
});
