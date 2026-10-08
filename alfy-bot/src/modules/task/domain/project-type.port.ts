export abstract class ProjectTypeQueryPort {
  /**
   * Возвращает тип проекта пользователя: `'simple' | 'agile'`.
   * Если проекта с таким id нет, возвращает `null`.
   */
  abstract getType(projectId: string): Promise<'simple' | 'agile' | null>;
}
