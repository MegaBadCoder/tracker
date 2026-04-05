import { ProjectColumn } from '../../../shared/entities';

export abstract class ProjectColumnRepositoryPort {
  abstract findAllByProject(projectId: string): Promise<ProjectColumn[]>;
  abstract findById(
    id: string,
    projectId: string,
  ): Promise<ProjectColumn | null>;
  abstract create(data: Partial<ProjectColumn>): Promise<ProjectColumn>;
  abstract save(column: ProjectColumn): Promise<ProjectColumn>;
  abstract delete(id: string, projectId: string): Promise<boolean>;
  abstract reorder(updates: { id: string; order: number }[]): Promise<void>;
}
