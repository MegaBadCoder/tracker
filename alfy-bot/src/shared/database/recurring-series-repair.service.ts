import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Task } from '../entities';

/** Completed families with no live member still had recurrence → ghosts. Strip. */
@Injectable()
export class RecurringSeriesRepairService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RecurringSeriesRepairService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    const repo = this.dataSource.getRepository(Task);
    const all = await repo.find();
    const familyIds = new Set<string>();
    for (const task of all) {
      if (task.recurrence || task.recurringParentId) {
        familyIds.add(task.recurringParentId ?? task.id);
      }
    }

    let stripped = 0;
    for (const familyId of familyIds) {
      const members = all.filter(
        (t) => t.id === familyId || t.recurringParentId === familyId,
      );
      const live = members.filter((t) => !t.completed && !t.isOverdue);
      for (const member of members) {
        if (!member.recurrence) continue;
        const isDeadRoot = member.completed && !member.recurringParentId && live.length === 0;
        const isCompletedChild = member.completed && Boolean(member.recurringParentId);
        if (!isDeadRoot && !isCompletedChild) continue;
        member.recurrence = null;
        await repo.save(member);
        stripped += 1;
      }
    }

    if (stripped > 0) {
      this.logger.log(
        `Stripped recurrence from ${stripped} task(s) in dead series`,
      );
    }
  }
}
