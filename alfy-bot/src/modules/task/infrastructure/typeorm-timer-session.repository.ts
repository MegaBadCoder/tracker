import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { TimerSession } from '../../../shared/entities/timer-session.entity';
import { TimerSessionRepositoryPort } from '../domain/timer-session-repository.port';

@Injectable()
export class TypeOrmTimerSessionRepository extends TimerSessionRepositoryPort {
  constructor(
    @InjectRepository(TimerSession)
    private readonly repo: Repository<TimerSession>,
  ) {
    super();
  }

  async findLatestByUser(
    userId: number,
    relations?: string[],
  ): Promise<TimerSession | null> {
    return this.repo.findOne({
      where: { userId },
      order: { updatedAt: 'DESC' },
      relations,
    });
  }

  async findExpiredActive(): Promise<TimerSession[]> {
    return this.repo.find({
      where: { isActive: true, expiresAt: LessThanOrEqual(new Date()) },
      relations: ['task'],
    });
  }

  async save(session: TimerSession): Promise<TimerSession> {
    return this.repo.save(session);
  }

  create(data: Partial<TimerSession>): TimerSession {
    return this.repo.create(data);
  }

  async remove(session: TimerSession): Promise<void> {
    await this.repo.remove(session);
  }
}
