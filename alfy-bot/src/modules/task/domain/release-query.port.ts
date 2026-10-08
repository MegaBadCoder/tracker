export type ReleaseStatusView = 'planned' | 'released';

export abstract class ReleaseQueryPort {
  /**
   * Возвращает проект и статус релиза.
   * Если релиза с таким id нет, возвращает `null`.
   */
  abstract getRelease(
    releaseId: string,
  ): Promise<{ projectId: string; status: ReleaseStatusView } | null>;
}
