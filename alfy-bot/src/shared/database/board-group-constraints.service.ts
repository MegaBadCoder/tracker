import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Имена всех триггеров, охраняющих инварианты `board_groups`/`tasks`:
 * родитель группы обязан быть эпиком, группа с детьми не переносится под
 * другого родителя, `groupId` задачи обязан ссылаться на группу того же
 * проекта.
 */
export const BOARD_GROUP_TRIGGER_NAMES = [
  'trg_board_group_parent_must_be_epic_insert',
  'trg_board_group_parent_must_be_epic_update',
  'trg_board_group_no_reparent_with_children',
  'trg_task_group_same_project_insert',
  'trg_task_group_same_project_update',
] as const;

/**
 * Удаляет триггеры {@link BOARD_GROUP_TRIGGER_NAMES}. Вызывается перед
 * `DataSource.synchronize()`: SQLite при пересборке `board_groups`/`tasks`
 * (rename → create → copy → drop) ревалидирует все триггеры на затронутых
 * таблицах и падает, если тело триггера ссылается на таблицу, отсутствующую
 * в момент проверки — без предварительного удаления `synchronize` не
 * запускается на базе, где триггеры уже установлены. После синхронизации
 * их создаёт заново {@link BoardGroupConstraintsMigrationService} (см.
 * `app.module`).
 */
export async function dropBoardGroupTriggers(
  dataSource: DataSource,
): Promise<void> {
  for (const name of BOARD_GROUP_TRIGGER_NAMES) {
    await dataSource.query(`DROP TRIGGER IF EXISTS ${name}`);
  }
}

/**
 * Устанавливает SQLite-триггеры, которыми проверяются инварианты
 * `board_groups`/`tasks`, невыразимые через CHECK (нужен взгляд на другие
 * строки): родитель группы обязан быть эпиком; группа с детьми не может
 * быть переподчинена; `groupId` задачи обязан указывать на группу того же
 * проекта, что и сама задача. Устанавливает их идемпотентно (`CREATE
 * TRIGGER IF NOT EXISTS`) на каждом старте приложения, поскольку
 * `synchronize: true` пересобирает таблицы при изменении схемы и не знает
 * про эти триггеры. Перед `synchronize` их обязана снять
 * {@link dropBoardGroupTriggers} — иначе SQLite не даст пересобрать
 * таблицу (см. `shared/database/create-data-source.ts`).
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
