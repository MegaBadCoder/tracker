import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AuthMethodMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthMethodMigrationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    const hasTelegramIdColumn = await this.columnExists('user', 'telegramId');
    if (!hasTelegramIdColumn) {
      this.logger.log(
        'user.telegramId column not found — migration already done or not needed',
      );
      return;
    }

    const users: Array<{ id: number; telegramId: number }> =
      await this.dataSource.query(
        'SELECT id, telegramId FROM user WHERE telegramId IS NOT NULL',
      );

    if (users.length === 0) {
      this.logger.log('No users with telegramId found, skipping migration');
      return;
    }

    let migrated = 0;
    for (const user of users) {
      const existing = await this.dataSource.query(
        'SELECT id FROM auth_method WHERE provider = \'telegram\' AND providerUserId = ?',
        [String(user.telegramId)],
      );

      if (existing.length > 0) continue;

      await this.dataSource.query(
        'INSERT INTO auth_method (userId, provider, providerUserId, emailVerified) VALUES (?, \'telegram\', ?, 0)',
        [user.id, String(user.telegramId)],
      );
      migrated++;
    }

    this.logger.log(
      `Migrated ${migrated} users from user.telegramId to auth_method`,
    );
  }

  private async columnExists(table: string, column: string): Promise<boolean> {
    const cols: Array<{ name: string }> = await this.dataSource.query(
      `PRAGMA table_info(${table})`,
    );
    return cols.some((c) => c.name === column);
  }
}
