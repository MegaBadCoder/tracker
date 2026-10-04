export abstract class BoardGroupQueryPort {
  /** Возвращает проект и релиз истории; для эпика или отсутствующей группы — null. */
  abstract getStoryRelease(
    groupId: string,
  ): Promise<{ projectId: string; releaseId: string | null } | null>;

  /**
   * Возвращает id проекта, которому принадлежит группа (эпик/история).
   * Если группы с таким id нет, возвращает `null`.
   */
  abstract getProjectId(groupId: string): Promise<string | null>;
}
