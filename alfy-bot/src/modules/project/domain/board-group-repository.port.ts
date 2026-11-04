import { BoardGroup } from '../../../shared/entities';

export abstract class BoardGroupRepositoryPort {
  abstract findAllByProject(projectId: string): Promise<BoardGroup[]>;
  abstract findById(id: string, projectId: string): Promise<BoardGroup | null>;
  abstract countChildren(id: string): Promise<number>;
  abstract create(data: Partial<BoardGroup>): Promise<BoardGroup>;
  /** Сохраняет редактируемые метаданные группы; назначения спринта/релиза и порядок не изменяются. */
  abstract save(group: BoardGroup): Promise<BoardGroup>;
  abstract delete(id: string, projectId: string): Promise<boolean>;
  abstract reorder(
    projectId: string,
    updates: { id: string; order: number }[],
  ): Promise<void>;
}
