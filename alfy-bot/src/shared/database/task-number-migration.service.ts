import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface ProjectToNumber {
  id: string;
  nextTaskNumber: number;
  maxNumber: number | null;
}

/**
 * При каждом старте приложения нумерует задачи agile-проектов, у которых
 * ещё нет номера: по `createdAt`, при равенстве по `id`, начиная с
 * `nextTaskNumber` проекта, и сдвигает счётчик проекта за последний выданный
 * номер. Идемпотентна: задачи с номером и проекты без ненумерованных задач
 * не меняются. Задачи обычных проектов и Входящих не затрагиваются.
 *
 * Учитывает и проекты с устаревшим `viewMode = 'agile'`: порядок запуска
 * с `ProjectTypeMigrationService` не гарантирован.
 *
 * Если счётчик проекта отстаёт от максимального существующего номера,
 * нумерация продолжается с максимума + 1, чтобы не нарушить уникальность.
 */
@Injectable()
export class TaskNumberMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TaskNumberMigrationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    const projects: ProjectToNumber[] = await this.dataSource.query(`
      SELECT
        p.id AS id,
        p.nextTaskNumber AS nextTaskNumber,
        (SELECT MAX(t.number) FROM tasks t WHERE t.projectId = p.id) AS maxNumber
      FROM projects p
      WHERE (p.type = 'agile' OR p.viewMode = 'agile')
        AND EXISTS (
          SELECT 1 FROM tasks t WHERE t.projectId = p.id AND t.number IS NULL
        )
    `);

    let numbered = 0;
    for (const project of projects) {
      numbered += await this.numberProjectTasks(project);
    }

    this.logger.log(`tasks: assigned numbers to ${numbered} agile tasks`);
  }

  private async numberProjectTasks(project: ProjectToNumber): Promise<number> {
    const firstFree = (project.maxNumber ?? 0) + 1;
    if (firstFree > project.nextTaskNumber) {
      this.logger.warn(
        `project ${project.id}: nextTaskNumber=${project.nextTaskNumber} is behind max task number ${project.maxNumber}, continuing from ${firstFree}`,
      );
    }
    let next = Math.max(project.nextTaskNumber, firstFree);

    return this.dataSource.transaction(async (manager) => {
      const tasks: { id: string }[] = await manager.query(
        `SELECT id FROM tasks
         WHERE projectId = ? AND number IS NULL
         ORDER BY createdAt ASC, id ASC`,
        [project.id],
      );

      for (const task of tasks) {
        await manager.query('UPDATE tasks SET number = ? WHERE id = ?', [
          next,
          task.id,
        ]);
        next += 1;
      }
      await manager.query(
        'UPDATE projects SET nextTaskNumber = ? WHERE id = ?',
        [next, project.id],
      );
      return tasks.length;
    });
  }
}
