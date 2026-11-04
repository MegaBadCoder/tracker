import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import { createTestApp } from "./helpers/test-app";
import {
  Project,
  ProjectColumn,
  Sprint,
  Task,
  PomodoroConfig,
} from "../src/shared/entities";
import { OverdueRecurringService } from "../src/modules/task/overdue-recurring.service";
import { TaskService } from "../src/modules/task/task.service";
import { TaskRepositoryPort } from "../src/modules/task/domain/task-repository.port";
import { ProjectTaskService } from "../src/modules/project/project-task.service";
import { PlanningService } from "../src/modules/project/planning.service";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("Планирование одновременно с обычными изменениями задач (SQLite)", () => {
  let app: INestApplication;
  let source: DataSource;
  let userId: number;
  let taskService: TaskService;
  let boardService: ProjectTaskService;
  let planning: PlanningService;
  let taskRepo: TaskRepositoryPort;

  beforeAll(async () => {
    ({ app, userId } = await createTestApp());
    source = app.get(DataSource);
    taskService = app.get(TaskService);
    boardService = app.get(ProjectTaskService);
    planning = app.get(PlanningService);
    taskRepo = app.get(TaskRepositoryPort);
  });
  afterAll(async () => {
    await app.close();
  });

  it.each(["title", "checklist", "board"] as const)(
    "%s не возвращает старый спринт после конкурентного переноса",
    async (kind) => {
      const project = await source
        .getRepository(Project)
        .save({ userId, title: "Гонки", type: "agile" });
      const column = await source
        .getRepository(ProjectColumn)
        .save({ projectId: project.id, title: "Первая", order: 0 });
      const sprint = await source
        .getRepository(Sprint)
        .save({ projectId: project.id, userId, name: "Спринт" });
      const task = await source
        .getRepository(Task)
        .save({
          userId,
          projectId: project.id,
          title: "Исходная",
          columnId: column.id,
        });
      const entered = deferred();
      const release = deferred();
      const originalFind = taskRepo.findById.bind(taskRepo);
      let held = false;
      const read = jest
        .spyOn(taskRepo, "findById")
        .mockImplementation(async (id, owner) => {
          const result = await originalFind(id, owner);
          if (id === task.id && !held) {
            held = true;
            entered.resolve();
            await release.promise;
          }
          return result;
        });
      try {
        const edit =
          kind === "title"
            ? taskService.update(userId, task.id, { title: "Обновлена" })
            : kind === "checklist"
              ? taskService.updateChecklist(userId, task.id, {
                  items: [
                    {
                      id: "item",
                      text: "Проверка",
                      completed: false,
                      order: 0,
                    },
                  ],
                })
              : boardService.moveTask(userId, project.id, task.id, {
                  columnId: column.id,
                  order: 3,
                });
        await entered.promise;
        const move = planning.move(userId, project.id, {
          taskIds: [task.id],
          storyIds: [],
          sprintId: sprint.id,
        });
        await new Promise<void>((done) => setImmediate(done));
        release.resolve();
        await Promise.all([edit, move]);
        const actual = await source
          .getRepository(Task)
          .findOneByOrFail({ id: task.id });
        expect(actual.sprintId).toBe(sprint.id);
        expect(actual.columnId).toBe(column.id);
        if (kind === "title") expect(actual.title).toBe("Обновлена");
        if (kind === "checklist")
          expect(actual.checklist?.items[0].text).toBe("Проверка");
        if (kind === "board") expect(actual.order).toBe(3);
      } finally {
        release.resolve();
        read.mockRestore();
      }
    },
  );
  it("ночная обработка повторения не возвращает старое назначение спринта", async () => {
    const project = await source
      .getRepository(Project)
      .save({ userId, title: "Повторения", type: "agile" });
    await source
      .getRepository(ProjectColumn)
      .save({ projectId: project.id, title: "Первая", order: 0 });
    const sprint = await source
      .getRepository(Sprint)
      .save({ projectId: project.id, userId, name: "Спринт" });
    const task = await source
      .getRepository(Task)
      .save({
        userId,
        projectId: project.id,
        title: "Повторение",
        dueDate: new Date("2026-11-01T09:00:00Z"),
        recurrence: { frequency: "daily", interval: 1 },
        onMissed: "shift",
      });
    const entered = deferred();
    const release = deferred();
    const original = taskRepo.findOverdueRecurringCandidates.bind(taskRepo);
    const read = jest
      .spyOn(taskRepo, "findOverdueRecurringCandidates")
      .mockImplementation(async (...args) => {
        const result = await original(...args);
        entered.resolve();
        await release.promise;
        return result;
      });
    try {
      const processing = app
        .get(OverdueRecurringService)
        .processForUser(userId, "UTC", new Date("2026-11-04T00:00:00Z"));
      await entered.promise;
      const move = planning.move(userId, project.id, {
        taskIds: [task.id],
        storyIds: [],
        sprintId: sprint.id,
      });
      await new Promise<void>((done) => setImmediate(done));
      release.resolve();
      await Promise.all([processing, move]);
      const actual = await source
        .getRepository(Task)
        .findOneByOrFail({ id: task.id });
      expect(actual.sprintId).toBe(sprint.id);
      expect(actual.dueDate?.toISOString()).toBe("2026-11-04T09:00:00.000Z");
    } finally {
      release.resolve();
      read.mockRestore();
    }
  });

  it("автозавершение Pomodoro повторно входит в ту же очередь без блокировки", async () => {
    const task = await source
      .getRepository(Task)
      .save({ userId, title: "Pomodoro" });
    await source
      .getRepository(PomodoroConfig)
      .save({ taskId: task.id, pomodoroCount: 1, pomodoroDuration: 25 });
    const result = await taskService.incrementPomodoro(userId, task.id, 1);
    expect(result.task.completed).toBe(true);
    expect(result.task.pomodoroConfig?.pomodoroCompleted).toBe(1);
    const repeated = await taskService.update(userId, task.id, {
      title: "Очередь свободна",
    });
    expect(repeated.task.title).toBe("Очередь свободна");
  });
});
