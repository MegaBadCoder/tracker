import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TimerSessionService } from '../timer-session.service';

@Injectable()
export class TimerExpiryScheduler {
  constructor(private readonly timerService: TimerSessionService) {}

  @Cron('*/30 * * * * *')
  async run(): Promise<void> {
    await this.timerService.processExpiredTimers();
  }
}
