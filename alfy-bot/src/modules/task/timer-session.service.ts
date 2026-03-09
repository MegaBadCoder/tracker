import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { LessThanOrEqual, Repository } from 'typeorm';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { TimerSession, User } from '../../shared/entities';
import { UpsertTimerSessionDto } from './dto/upsert-timer-session.dto';

@Injectable()
export class TimerSessionService {
  private readonly logger = new Logger(TimerSessionService.name);

  constructor(
    @InjectRepository(TimerSession)
    private readonly timerRepo: Repository<TimerSession>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectBot() private readonly bot: Telegraf,
  ) {}

  private async getTelegramId(userId: number): Promise<number | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return user?.telegramId ?? null;
  }

  private async sendNotification(
    userId: number,
    message: string,
  ): Promise<void> {
    const telegramId = await this.getTelegramId(userId);
    if (!telegramId) {
      this.logger.warn(`User ${userId} has no telegramId`);
      return;
    }
    try {
      await this.bot.telegram.sendMessage(telegramId, message);
    } catch (err) {
      this.logger.error(
        `Failed to send timer notification to telegramId=${telegramId}`,
        err,
      );
    }
  }

  async upsert(
    userId: number,
    dto: UpsertTimerSessionDto,
  ): Promise<TimerSession> {
    let session = await this.timerRepo.findOne({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });

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
    return this.timerRepo.findOne({
      where: { userId },
      order: { updatedAt: 'DESC' },
      relations: ['task', 'task.pomodoroConfig'],
    });
  }

  async deactivate(userId: number): Promise<void> {
    const session = await this.timerRepo.findOne({
      where: { userId },
      order: { updatedAt: 'DESC' },
      relations: ['task'],
    });
    if (!session) return;

    await this.sendNotification(
      userId,
      `⏹ Таймер по задаче "${session.task?.title}" остановлен`,
    );
    await this.timerRepo.remove(session);
  }

  @Cron('*/30 * * * * *')
  async handleExpiredTimers(): Promise<void> {
    const expired = await this.timerRepo.find({
      where: { isActive: true, expiresAt: LessThanOrEqual(new Date()) },
      relations: ['task'],
    });

    for (const session of expired) {
      session.isActive = false;
      await this.timerRepo.save(session);

      await this.sendNotification(
        session.userId,
        `⏰ Таймер по задаче "${session.task?.title}" завершён!`,
      );
    }
  }
}
