import { Sprint } from '../../../shared/entities';

export abstract class SprintRepositoryPort {
  /** Все спринты проекта, включая закрытые, по возрастанию `order`. */
  abstract findAllByProject(projectId: string): Promise<Sprint[]>;

  /** Спринт с `id` в проекте `projectId` либо `null`, если такого нет. */
  abstract findById(id: string, projectId: string): Promise<Sprint | null>;

  /** Активный спринт проекта либо `null`, если активного нет. */
  abstract findActive(projectId: string): Promise<Sprint | null>;

  abstract create(data: Partial<Sprint>): Promise<Sprint>;

  abstract save(sprint: Sprint): Promise<Sprint>;

  /**
   * Удаляет спринт проекта. Задачи спринта не удаляются: их `sprintId`
   * обнуляется внешним ключом.
   *
   * @returns `false`, если спринта в проекте нет.
   */
  abstract delete(id: string, projectId: string): Promise<boolean>;

  /**
   * В одной транзакции переводит спринт в `closed`, ставит `completedAt` и
   * переносит его незавершённые задачи (`completed = false`) в спринт
   * `moveToSprintId` либо в бэклог, если передан `null`. Выполненные задачи
   * и задачи других спринтов не затрагиваются. При ошибке ничего не меняется.
   */
  abstract closeAndMoveUnfinished(
    sprintId: string,
    moveToSprintId: string | null,
  ): Promise<void>;

  /** Атомарно назначает спринт истории проекта и её задачам вне закрытых спринтов; возвращает число обновлённых задач. */
  abstract setGroupSprint(
    projectId: string,
    groupId: string,
    sprintId: string | null,
  ): Promise<number>;
}
