import { Project } from '../../../shared/entities';

export abstract class ProjectRepositoryPort {
  abstract findAllByUser(userId: number): Promise<Project[]>;
  abstract findById(id: string, userId: number): Promise<Project | null>;
  abstract findByIdWithRelations(
    id: string,
    userId: number,
  ): Promise<Project | null>;
  abstract create(data: Partial<Project>): Promise<Project>;
  abstract save(project: Project): Promise<Project>;
  abstract delete(id: string, userId: number): Promise<boolean>;
  abstract reorder(updates: { id: string; order: number }[]): Promise<void>;
}
