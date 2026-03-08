import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class QuestionMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(QuestionMigrationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    const hasOldTable = await this.tableExists('goal_questions');
    if (!hasOldTable) {
      this.logger.log(
        'goal_questions table not found — migration already done or fresh DB, skipping',
      );
      return;
    }

    this.logger.warn(
      'Found goal_questions table — migrating data to questions/schedules',
    );

    await this.dataSource.query(`PRAGMA foreign_keys=off`);
    try {
      await this.dataSource.query(`BEGIN TRANSACTION`);

      // Copy questions with new columns
      await this.dataSource.query(`
        INSERT INTO "questions" ("id", "goal_id", "user_id", "question", "type", "can_skip", "order_index", "is_active", "is_habit", "createdAt")
        SELECT "id", "goal_id", NULL, "question", "type", "can_skip", "order_index", "is_active", 0, "createdAt"
        FROM "goal_questions"
      `);

      // Backfill user_id from goals
      await this.dataSource.query(`
        UPDATE "questions" SET "user_id" = (
          SELECT "user_id" FROM "goals" WHERE "goals"."id" = "questions"."goal_id"
        )
        WHERE "goal_id" IS NOT NULL
      `);

      // Copy schedules
      await this.dataSource.query(`
        INSERT INTO "schedules" ("id", "question_id", "frequency_type", "days_of_week", "interval_days", "effective_from", "createdAt")
        SELECT "id", "question_id", "frequency_type", "days_of_week", "interval_days", "effective_from", "createdAt"
        FROM "goal_schedules"
      `);

      // Drop old tables
      await this.dataSource.query(`DROP TABLE "goal_schedules"`);
      await this.dataSource.query(`DROP TABLE "goal_questions"`);

      await this.dataSource.query(`COMMIT`);
      this.logger.log(
        'Migration complete: goal_questions → questions, goal_schedules → schedules',
      );
    } catch (error) {
      await this.dataSource.query(`ROLLBACK`).catch(() => {});
      this.logger.error('Question migration failed', error);
      throw error;
    } finally {
      await this.dataSource.query(`PRAGMA foreign_keys=on`);
    }
  }

  private async tableExists(name: string): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [name],
    );
    return result.length > 0;
  }
}
