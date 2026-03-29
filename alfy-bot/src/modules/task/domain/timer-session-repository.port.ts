import { TimerSession } from '../../../shared/entities/timer-session.entity';

export abstract class TimerSessionRepositoryPort {
  abstract findLatestByUser(
    userId: number,
    relations?: string[],
  ): Promise<TimerSession | null>;
  abstract findExpiredActive(): Promise<TimerSession[]>;
  abstract save(session: TimerSession): Promise<TimerSession>;
  abstract create(data: Partial<TimerSession>): TimerSession;
  abstract remove(session: TimerSession): Promise<void>;
}
