import type { Sprint, SprintEvent } from '../../../shared/entities';
import type {
  PlanningData,
  PlanningMove,
  PlanningOrder,
  PlanningSnapshot,
} from './planning';

export abstract class PlanningRepositoryPort {
  abstract load(userId: number, projectId: string): Promise<PlanningData>;
  abstract move(
    userId: number,
    projectId: string,
    input: PlanningMove,
  ): Promise<{ updated: number; undoToken: string }>;
  abstract undo(
    userId: number,
    projectId: string,
    token: string,
  ): Promise<{ updated: number }>;
  abstract reorder(
    userId: number,
    projectId: string,
    input: PlanningOrder,
  ): Promise<{ updated: number }>;
  abstract report(
    userId: number,
    projectId: string,
    sprintId: string,
  ): Promise<{
    sprint: Sprint;
    current: PlanningSnapshot;
    events: SprintEvent[];
  }>;
}
