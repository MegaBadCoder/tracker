export abstract class BoardGroupQueryPort {
  /**
   * Возвращает id проекта, которому принадлежит группа (эпик/история).
   * Если группы с таким id нет, возвращает `null`.
   */
  abstract getProjectId(groupId: string): Promise<string | null>;
}
