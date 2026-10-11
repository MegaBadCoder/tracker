import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * При каждом старте приложения проставляет `type = 'agile'` проектам
 * с устаревшим `viewMode = 'agile'`. Идемпотентна: повторный запуск строки
 * не меняет.
 *
 * `viewMode` не переписывается: при откате кода это единственный признак,
 * по которому agile-проект можно опознать.
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
