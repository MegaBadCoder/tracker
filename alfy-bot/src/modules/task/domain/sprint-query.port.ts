export type SprintStatusView = 'planned' | 'active' | 'closed';

export abstract class SprintQueryPort {
  /**
   * Возвращает проект и статус спринта.
   * Если спринта с таким id нет, возвращает `null`.
   */
  abstract getSprint(
    sprintId: string,
  ): Promise<{ projectId: string; status: SprintStatusView } | null>;

  /**
   * Возвращает id колонки проекта с минимальным `order`.
   * Если у проекта нет колонок, возвращает `null`.
   */
  abstract firstColumnId(projectId: string): Promise<string | null>;
}
