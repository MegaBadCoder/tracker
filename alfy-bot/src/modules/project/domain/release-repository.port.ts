import { Release } from '../../../shared/entities';

export abstract class ReleaseRepositoryPort {
  /** Все релизы проекта, включая выпущенные, по возрастанию `order`. */
  abstract findAllByProject(projectId: string): Promise<Release[]>;

  /** Релиз с `id` в проекте `projectId` либо `null`, если такого нет. */
  abstract findById(id: string, projectId: string): Promise<Release | null>;

  abstract create(data: Partial<Release>): Promise<Release>;

  abstract save(release: Release): Promise<Release>;

  /**
   * Удаляет релиз проекта. Задачи релиза не удаляются: их `releaseId`
   * обнуляется внешним ключом.
   *
   * @returns `false`, если релиза в проекте нет.
   */
  abstract delete(id: string, projectId: string): Promise<boolean>;

  /**
   * В одной транзакции переводит релиз в `released`, ставит `releasedAt` и
   * переносит его незавершённые задачи (`completed = false`) в релиз
   * `moveToReleaseId` либо снимает с них релиз, если передан `null`.
   * Выполненные задачи и задачи других релизов не затрагиваются. При ошибке
   * ничего не меняется.
   */
  abstract releaseAndMoveUnfinished(
    releaseId: string,
    moveToReleaseId: string | null,
  ): Promise<void>;

  /**
   * Ставит `releaseId` всем задачам, чей `groupId` входит в `groupIds` и чей
   * проект совпадает с проектом релиза.
   *
   * @returns число затронутых задач; для пустого списка групп — 0.
   */
  abstract assignGroupTasks(
    releaseId: string,
    groupIds: string[],
  ): Promise<number>;
}
