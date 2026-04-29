import { Injectable } from '@nestjs/common';
import { TaskRepositoryPort } from './domain/task-repository.port';
import { UserSettingsPort } from './domain/user-settings.port';
import {
  buildNextInstance,
  computeNextDueDate,
  findNextOccurrenceOnOrAfter,
} from './domain/recurrence.utils';
import { shiftBackToUtc, shiftToUserWallClock } from './lib/timezone';

@Injectable()
export class OverdueRecurringService {
  constructor(
    private readonly taskRepo: TaskRepositoryPort,
    private readonly userSettings: UserSettingsPort,
  ) {}

  async processAllUsersAtMidnight(nowUtc: Date): Promise<void> {
    const userIds = await this.userSettings.listAllUserIds();

    for (const userId of userIds) {
      const tz = await this.userSettings.getTimezone(userId);
      const nowLocal = shiftToUserWallClock(nowUtc, tz);
      if (nowLocal.getUTCHours() !== 0) continue;
      await this.processForUser(userId, tz, nowUtc);
    }
  }

  async processForUser(
    userId: number,
    tz: string,
    nowUtc: Date,
  ): Promise<void> {
    const nowLocal = shiftToUserWallClock(nowUtc, tz);
    const startOfTodayLocal = new Date(nowLocal);
    startOfTodayLocal.setUTCHours(0, 0, 0, 0);
    const startOfTodayUtc = shiftBackToUtc(startOfTodayLocal, tz);

    const candidates = await this.taskRepo.findOverdueRecurringCandidates(
      userId,
      startOfTodayUtc,
    );

    for (const task of candidates) {
      const rule = task.recurrence!;
      const parentId = task.recurringParentId ?? task.id;
      const rootTask = task.recurringParentId
        ? await this.taskRepo.findById(parentId, userId)
        : task;
      const completedCount = rootTask?.recurringCompletedCount ?? 0;

      const zonedDue = shiftToUserWallClock(task.dueDate!, tz);

      if (task.onMissed === 'freeze') {
        const nextZoned = computeNextDueDate(zonedDue, rule, completedCount);
        const nextDate = nextZoned ? shiftBackToUtc(nextZoned, tz) : null;
        const successorData = nextDate
          ? buildNextInstance(task, nextDate, parentId)
          : null;
        await this.taskRepo.freezeAndCreateNext(task.id, successorData);
      } else {
        // 'shift'
        const nextZoned = findNextOccurrenceOnOrAfter(
          zonedDue,
          rule,
          startOfTodayLocal,
          completedCount,
        );

        if (nextZoned === null) {
          task.recurrence = null;
          await this.taskRepo.save(task);
        } else {
          task.dueDate = shiftBackToUtc(nextZoned, tz);
          await this.taskRepo.save(task);
        }
      }
    }
  }
}
