import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

const activeSprint = (id: string) =>
  `EXISTS (SELECT 1 FROM sprints WHERE id = ${id} AND status = 'active')`;
const eventInsert = (
  sprint: string,
  task: string,
  kind: string,
  title: string,
) => `
  INSERT INTO sprint_events (id, sprintId, taskId, kind, occurredAt, title)
  VALUES (lower(hex(randomblob(16))), ${sprint}, ${task}, '${kind}', strftime('%Y-%m-%dT%H:%M:%fZ','now'), ${title});`;

const definitions = [
  {
    name: 'trg_sprint_task_added',
    on: 'AFTER INSERT ON tasks',
    when: activeSprint('NEW.sprintId'),
    body: eventInsert('NEW.sprintId', 'NEW.id', 'added', 'NEW.title'),
  },
  {
    name: 'trg_sprint_task_deleted',
    on: 'BEFORE DELETE ON tasks',
    when: activeSprint('OLD.sprintId'),
    body: eventInsert('OLD.sprintId', 'OLD.id', 'removed', 'OLD.title'),
  },
  {
    name: 'trg_sprint_task_removed',
    on: 'AFTER UPDATE OF sprintId ON tasks',
    when: `OLD.sprintId IS NOT NEW.sprintId AND ${activeSprint('OLD.sprintId')}`,
    body: eventInsert('OLD.sprintId', 'OLD.id', 'removed', 'OLD.title'),
  },
  {
    name: 'trg_sprint_task_assigned',
    on: 'AFTER UPDATE OF sprintId ON tasks',
    when: `OLD.sprintId IS NOT NEW.sprintId AND ${activeSprint('NEW.sprintId')}`,
    body: eventInsert('NEW.sprintId', 'NEW.id', 'added', 'NEW.title'),
  },
  ...(['completed', 'reopened'] as const).map((kind) => ({
    name: `trg_sprint_task_${kind}`,
    on: 'AFTER UPDATE OF completed ON tasks',
    when: `OLD.completed IS NOT NEW.completed AND NEW.completed = ${kind === 'completed' ? 1 : 0} AND ${activeSprint('NEW.sprintId')}`,
    body: eventInsert('NEW.sprintId', 'NEW.id', kind, 'NEW.title'),
  })),
  {
    name: 'trg_sprint_task_changed',
    on: 'AFTER UPDATE OF title, durationMinutes ON tasks',
    when: `(OLD.title IS NOT NEW.title OR OLD.durationMinutes IS NOT NEW.durationMinutes) AND ${activeSprint('NEW.sprintId')}`,
    body: eventInsert('NEW.sprintId', 'NEW.id', 'updated', 'NEW.title'),
  },
  {
    name: 'trg_sprint_story_added',
    on: 'AFTER INSERT ON board_groups',
    when: `NEW.type = 'story' AND ${activeSprint('NEW.sprintId')}`,
    body: eventInsert('NEW.sprintId', 'NULL', 'story_added', 'NEW.title'),
  },
  {
    name: 'trg_sprint_story_removed',
    on: 'AFTER UPDATE OF sprintId ON board_groups',
    when: `OLD.sprintId IS NOT NEW.sprintId AND ${activeSprint('OLD.sprintId')}`,
    body: eventInsert('OLD.sprintId', 'NULL', 'story_removed', 'OLD.title'),
  },
  {
    name: 'trg_sprint_story_assigned',
    on: 'AFTER UPDATE OF sprintId ON board_groups',
    when: `OLD.sprintId IS NOT NEW.sprintId AND ${activeSprint('NEW.sprintId')}`,
    body: eventInsert('NEW.sprintId', 'NULL', 'story_added', 'NEW.title'),
  },
  {
    name: 'trg_sprint_story_deleted',
    on: 'BEFORE DELETE ON board_groups',
    when: activeSprint('OLD.sprintId'),
    body: eventInsert('OLD.sprintId', 'NULL', 'story_removed', 'OLD.title'),
  },
  {
    name: 'trg_sprint_story_status',
    on: 'AFTER UPDATE OF status, workflowStatusId ON board_groups',
    when: `(OLD.status IS NOT NEW.status OR OLD.workflowStatusId IS NOT NEW.workflowStatusId) AND ${activeSprint('NEW.sprintId')}`,
    body: eventInsert('NEW.sprintId', 'NULL', 'story_status', 'NEW.title'),
  },
  ...(['INSERT', 'UPDATE', 'DELETE'] as const).map((operation) => {
    const row = operation === 'DELETE' ? 'OLD' : 'NEW';
    const sprint = `(SELECT sprintId FROM tasks WHERE id = ${row}.taskId)`;
    return {
      name: `trg_sprint_pomodoro_${operation.toLowerCase()}`,
      on: `AFTER ${operation} ON pomodoro_configs`,
      when: activeSprint(sprint),
      body: eventInsert(
        sprint,
        `${row}.taskId`,
        'estimate_changed',
        `(SELECT title FROM tasks WHERE id = ${row}.taskId)`,
      ),
    };
  }),
];

export const SPRINT_HISTORY_TRIGGER_NAMES = definitions.map((d) => d.name);

/** Устанавливает идемпотентные триггеры истории для всех путей изменения задач и историй активного спринта. */
@Injectable()
export class SprintHistoryService implements OnApplicationBootstrap {
  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const definition of definitions) {
      await this.dataSource.query(
        `CREATE TRIGGER IF NOT EXISTS ${definition.name} ${definition.on} WHEN ${definition.when} BEGIN ${definition.body} END;`,
      );
    }
  }
}
