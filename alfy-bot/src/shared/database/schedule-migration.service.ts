import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ScheduleMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScheduleMigrationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    const hasUnique = await this.hasUniqueConstraint();
    if (!hasUnique) {
      this.logger.log(
        'goal_schedules: UNIQUE constraint on question_id already removed, skipping migration',
      );
      return;
    }

    this.logger.warn(
      'goal_schedules: found UNIQUE constraint on question_id — recreating table without it',
    );

    await this.dataSource.query(`PRAGMA foreign_keys=off`);
    try {
      await this.dataSource.query(`BEGIN TRANSACTION`);
      await this.dataSource.query(`
        CREATE TABLE "goal_schedules_new" (
          "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          "question_id" integer NOT NULL,
          "frequency_type" text NOT NULL,
          "days_of_week" text,
          "interval_days" integer,
          "effective_from" text,
          "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_924fece13eddc6c81e5e2445397" FOREIGN KEY ("question_id") REFERENCES "goal_questions" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        )
      `);
      await this.dataSource.query(
        `INSERT INTO "goal_schedules_new" SELECT "id", "question_id", "frequency_type", "days_of_week", "interval_days", "effective_from", "createdAt" FROM "goal_schedules"`,
      );
      await this.dataSource.query(`DROP TABLE "goal_schedules"`);
      await this.dataSource.query(
        `ALTER TABLE "goal_schedules_new" RENAME TO "goal_schedules"`,
      );
      await this.dataSource.query(`COMMIT`);
      this.logger.log(
        'goal_schedules: migration complete — UNIQUE constraint removed',
      );
    } catch (error) {
      await this.dataSource.query(`ROLLBACK`).catch(() => {});
      this.logger.error('goal_schedules migration failed', error);
      throw error;
    } finally {
      await this.dataSource.query(`PRAGMA foreign_keys=on`);
    }
  }

  private async hasUniqueConstraint(): Promise<boolean> {
    const indexes: { unique: number; name: string }[] =
      await this.dataSource.query(`PRAGMA index_list('goal_schedules')`);

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
