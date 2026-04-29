import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OverdueRecurringService } from '../overdue-recurring.service';

@Injectable()
export class OverdueRecurringScheduler {
  constructor(private readonly service: OverdueRecurringService) {}

  @Cron('0 * * * *')
  async run(): Promise<void> {
    await this.service.processAllUsersAtMidnight(new Date());
  }
}
