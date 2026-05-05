import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ScheduleMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScheduleMigrationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    // Check if the old goal_schedules table still exists (pre-rename migration)
    const hasOldTable = await this.tableExists('goal_schedules');
    if (!hasOldTable) {
      // Already migrated to new "schedules" table — check that one instead
      const hasNewTable = await this.tableExists('schedules');
      if (!hasNewTable) {
        this.logger.log('No schedules table found, skipping migration');
        return;
      }
      // Check unique constraint on new table
      const hasUnique = await this.hasUniqueConstraintOn('schedules');
      if (!hasUnique) {
        this.logger.log(
          'schedules: UNIQUE constraint on question_id already removed, skipping',
        );
        return;
      }

      this.logger.warn(
        'schedules: found UNIQUE constraint on question_id — recreating table without it',
      );
      await this.removeForeignKeyConstraint('schedules', 'questions');
      return;
    }

    // Old table exists — check unique constraint on it
    const hasUnique = await this.hasUniqueConstraintOn('goal_schedules');
    if (!hasUnique) {
      this.logger.log(
        'goal_schedules: UNIQUE constraint on question_id already removed, skipping migration',
      );
      return;
    }

    this.logger.warn(
      'goal_schedules: found UNIQUE constraint on question_id — recreating table without it',
    );

    await this.removeForeignKeyConstraint('goal_schedules', 'goal_questions');
  }

  private async removeForeignKeyConstraint(tableName: string, fkTable: string) {
    await this.dataSource.query('PRAGMA foreign_keys=off');
    try {
      await this.dataSource.query('BEGIN TRANSACTION');
      await this.dataSource.query(`
        CREATE TABLE "${tableName}_new" (
          "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          "question_id" integer NOT NULL,
          "frequency_type" text NOT NULL,
          "days_of_week" text,
          "interval_days" integer,
          "effective_from" text,
          "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_schedule_question" FOREIGN KEY ("question_id") REFERENCES "${fkTable}" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        )
      `);
      await this.dataSource.query(
        `INSERT INTO "${tableName}_new" SELECT "id", "question_id", "frequency_type", "days_of_week", "interval_days", "effective_from", "createdAt" FROM "${tableName}"`,
      );
      await this.dataSource.query(`DROP TABLE "${tableName}"`);
      await this.dataSource.query(
        `ALTER TABLE "${tableName}_new" RENAME TO "${tableName}"`,
      );
      await this.dataSource.query('COMMIT');
      this.logger.log(
        `${tableName}: migration complete — UNIQUE constraint removed`,
      );
    } catch (error) {
      await this.dataSource.query('ROLLBACK').catch(() => {});
      this.logger.error(`${tableName} migration failed`, error);
      throw error;
    } finally {
      await this.dataSource.query('PRAGMA foreign_keys=on');
    }
  }

  private async tableExists(name: string): Promise<boolean> {
    const result = await this.dataSource.query(
      'SELECT name FROM sqlite_master WHERE type=\'table\' AND name=?',
      [name],
    );
    return result.length > 0;
  }

  private async hasUniqueConstraintOn(tableName: string): Promise<boolean> {
    const indexes: { unique: number; name: string }[] =
      await this.dataSource.query(`PRAGMA index_list('${tableName}')`);

    for (const idx of indexes) {
      if (idx.unique !== 1) continue;
      const cols: { name: string }[] = await this.dataSource.query(
        `PRAGMA index_info('${idx.name}')`,
      );
      if (cols.some((col) => col.name === 'question_id')) return true;
    }
    return false;
  }
}
