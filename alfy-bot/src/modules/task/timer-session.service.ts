import { Injectable } from '@nestjs/common';
import { TimerSession } from '../../shared/entities/timer-session.entity';
import { TimerSessionRepositoryPort } from './domain/timer-session-repository.port';
import { NotificationPort } from './domain/notification.port';
import { UpsertTimerSessionDto } from './dto/upsert-timer-session.dto';

@Injectable()
export class TimerSessionService {
  constructor(
    private readonly timerRepo: TimerSessionRepositoryPort,
    private readonly notification: NotificationPort,
  ) {}

  async upsert(
    userId: number,
    dto: UpsertTimerSessionDto,
  ): Promise<TimerSession> {
    let session = await this.timerRepo.findLatestByUser(userId);

    if (session) {
      session.taskId = dto.taskId;
      session.phase = dto.phase;
      session.lastStartTime = dto.lastStartTime ?? null;
      session.countTimeAfterPause = dto.countTimeAfterPause ?? null;
      session.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
      session.isActive = dto.isActive;
    } else {
      session = this.timerRepo.create({
        userId,
        taskId: dto.taskId,
        phase: dto.phase,
        lastStartTime: dto.lastStartTime ?? null,
        countTimeAfterPause: dto.countTimeAfterPause ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive,
      });
    }

    return this.timerRepo.save(session);
  }

  async getLatest(userId: number): Promise<TimerSession | null> {
    return this.timerRepo.findLatestByUser(userId, [
      'task',
      'task.pomodoroConfig',
    ]);
  }

  async deactivate(userId: number): Promise<void> {
    const session = await this.timerRepo.findLatestByUser(userId, ['task']);
    if (!session) return;

    await this.notification.send(
      userId,
      `⏹ Таймер по задаче "${session.task?.title}" остановлен`,
    );
    await this.timerRepo.remove(session);
  }

  async processExpiredTimers(): Promise<void> {
    const expired = await this.timerRepo.findExpiredActive();

    for (const session of expired) {
      session.isActive = false;
      await this.timerRepo.save(session);

      await this.notification.send(
        session.userId,
        `⏰ Таймер по задаче "${session.task?.title}" завершён!`,
      );
    }
  }
}
