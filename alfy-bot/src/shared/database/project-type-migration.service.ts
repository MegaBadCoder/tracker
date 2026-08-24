import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * `Project.type` was introduced to separate "what kind of project this is"
 * (a domain property, set at creation) from `viewMode` (a display setting).
 * Existing projects created before this split have their agile-ness encoded
 * only in `viewMode = 'agile'` (a value the narrowed `viewMode` union no
 * longer accepts going forward). This service copies that signal into the
 * new `type` column on every bootstrap, idempotently.
 *
 * `viewMode` is intentionally left untouched — it's the only surviving
 * record of which projects were agile before this migration, in case the
 * code needs to be rolled back.
 */
@Injectable()
export class ProjectTypeMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProjectTypeMigrationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    await this.dataSource.query(`
      UPDATE projects
      SET type = 'agile'
      WHERE viewMode = 'agile' AND type <> 'agile'
    `);

    this.logger.log(
      'projects: ensured type=agile for every row with viewMode=agile',
    );
  }
}
