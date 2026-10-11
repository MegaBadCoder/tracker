import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TaskNumberPort } from '../domain/task-number.port';

// Реализация обновляет projects напрямую, а не через ProjectModule:
// ProjectModule уже импортирует TaskModule, и порт на стороне проекта замкнул бы цикл.
@Injectable()
export class TypeOrmTaskNumberAdapter extends TaskNumberPort {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async allocate(projectId: string | null): Promise<number | null> {
    if (projectId === null) return null;

    // TypeORM выполняет запросы, начинающиеся с "UPDATE ", через run() без строк результата;
    // ведущий перевод строки заставляет вернуть RETURNING-строки.
    const rows: { number: number }[] = await this.dataSource.query(
      `
       UPDATE projects
       SET nextTaskNumber = nextTaskNumber + 1
       WHERE id = ? AND type = 'agile'
       RETURNING nextTaskNumber - 1 AS number`,
      [projectId],
    );
    return rows.length > 0 ? rows[0].number : null;
  }
}
