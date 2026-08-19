import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * SQLite triggers enforcing BoardGroup invariants that CHECK constraints
 * cannot express (they need to look at other rows):
 *
 * - a group's parent must itself be a top-level group (an epic) — depth is
 *   exactly 2, an epic can never be attached under a story;
 * - a group that already has children cannot be reparented (turned into a
 *   story);
 * - a task's groupId must reference a group belonging to the same project
 *   as the task.
 *
 * `synchronize: true` recreates the board_groups/tasks tables (rename →
 * create → copy → drop) whenever their schema changes, which silently drops
 * every trigger attached to them. This service re-creates the triggers
 * idempotently on every application bootstrap so the protection survives
 * schema changes.
 */
@Injectable()
export class BoardGroupConstraintsMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(
    BoardGroupConstraintsMigrationService.name,
  );

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    await this.dataSource.query(`
      CREATE TRIGGER IF NOT EXISTS trg_board_group_parent_must_be_epic_insert
      BEFORE INSERT ON board_groups
      WHEN NEW.parentId IS NOT NULL
      BEGIN
        SELECT RAISE(ABORT, 'board_group: parent must be an epic')
        WHERE (SELECT parentId FROM board_groups WHERE id = NEW.parentId) IS NOT NULL;
      END;
    `);

    await this.dataSource.query(`
      CREATE TRIGGER IF NOT EXISTS trg_board_group_parent_must_be_epic_update
      BEFORE UPDATE ON board_groups
      WHEN NEW.parentId IS NOT NULL
      BEGIN
        SELECT RAISE(ABORT, 'board_group: parent must be an epic')
        WHERE (SELECT parentId FROM board_groups WHERE id = NEW.parentId) IS NOT NULL;
      END;
    `);

    await this.dataSource.query(`
      CREATE TRIGGER IF NOT EXISTS trg_board_group_no_reparent_with_children
      BEFORE UPDATE ON board_groups
      WHEN NEW.parentId IS NOT NULL
      BEGIN
        SELECT RAISE(ABORT, 'board_group: cannot reparent a group that has children')
        WHERE EXISTS (SELECT 1 FROM board_groups WHERE parentId = OLD.id);
      END;
    `);

    await this.dataSource.query(`
      CREATE TRIGGER IF NOT EXISTS trg_task_group_same_project_insert
      BEFORE INSERT ON tasks
      WHEN NEW.groupId IS NOT NULL
      BEGIN
        SELECT RAISE(ABORT, 'task: group must belong to the same project as the task')
        WHERE (SELECT projectId FROM board_groups WHERE id = NEW.groupId) IS NOT NEW.projectId;
      END;
    `);

    await this.dataSource.query(`
      CREATE TRIGGER IF NOT EXISTS trg_task_group_same_project_update
      BEFORE UPDATE ON tasks
      WHEN NEW.groupId IS NOT NULL
      BEGIN
        SELECT RAISE(ABORT, 'task: group must belong to the same project as the task')
        WHERE (SELECT projectId FROM board_groups WHERE id = NEW.groupId) IS NOT NEW.projectId;
      END;
    `);

    this.logger.log('board_groups/tasks constraint triggers ensured');
  }
}
