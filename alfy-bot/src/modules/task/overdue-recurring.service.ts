import { Injectable } from '@nestjs/common';
import { PomodoroConfig, Task } from '../../shared/entities';
import { TaskRepositoryPort } from './domain/task-repository.port';
import { UserSettingsPort } from './domain/user-settings.port';
import {
  buildNextInstance,
  computeNextDueDate,
  findNextOccurrenceOnOrAfter,
  findOccupyingInstance,
  seriesDueDate,
} from './domain/recurrence.utils';
import { shiftBackToUtc, shiftToUserWallClock } from './lib/timezone';

function clonePomodoroConfigFresh(src: PomodoroConfig): PomodoroConfig {
  const c = new PomodoroConfig();
  c.pomodoroCount = src.pomodoroCount;
  c.pomodoroDuration = src.pomodoroDuration;
  c.shortBreak = src.shortBreak;
  c.longBreak = src.longBreak;
  c.longBreakInterval = src.longBreakInterval;
  c.pomodoroCompleted = 0;
  return c;
}

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

      const seriesDue = seriesDueDate({
        dueDate: task.dueDate,
        recurrenceAnchorDate: task.recurrenceAnchorDate ?? null,
      });
      const zonedDue = shiftToUserWallClock(seriesDue!, tz);

      const members = await this.taskRepo.findByParentId(parentId, true);
      const others = members.filter((m) => m.id !== task.id);
      const slotOccupied = (slotZoned: Date) =>
        !!findOccupyingInstance(
          others.map((m) => ({
            dueDate: m.dueDate ? shiftToUserWallClock(m.dueDate, tz) : null,
            recurrenceAnchorDate: m.recurrenceAnchorDate
              ? shiftToUserWallClock(m.recurrenceAnchorDate, tz)
              : null,
          })),
          slotZoned,
        );

      if (task.onMissed === 'freeze') {
        const nextZoned = computeNextDueDate(zonedDue, rule, completedCount);
        const occupied = nextZoned ? slotOccupied(nextZoned) : false;
        const nextDate =
          nextZoned && !occupied ? shiftBackToUtc(nextZoned, tz) : null;
        let successorData: Partial<Task> | null = nextDate
          ? buildNextInstance(task, nextDate, parentId)
          : null;
        if (successorData && task.pomodoroConfig) {
          successorData = {
            ...successorData,
            pomodoroConfig: clonePomodoroConfigFresh(task.pomodoroConfig),
          };
        }
        await this.taskRepo.freezeAndCreateNext(task.id, successorData);
      } else {
        // 'shift'
        const nextZoned = findNextOccurrenceOnOrAfter(
          zonedDue,
          rule,
          startOfTodayLocal,
          completedCount,
        );
        let cursor = nextZoned;
        while (cursor && slotOccupied(cursor)) {
          cursor = computeNextDueDate(cursor, rule, completedCount);
        }

        if (cursor === null) {
          task.recurrence = null;
          await this.taskRepo.save(task);
        } else {
          task.dueDate = shiftBackToUtc(cursor, tz);
          task.recurrenceAnchorDate = null;
          await this.taskRepo.save(task);
        }
      }
    }
  }
}
