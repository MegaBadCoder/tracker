import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Task, PomodoroConfig } from '../../shared/entities';
import { TaskRepositoryPort } from './domain/task-repository.port';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MaterializeOccurrenceDto } from './dto/materialize-occurrence.dto';
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { UpdatePomodoroConfigDto } from './dto/update-pomodoro-config.dto';
import { ReorderInboxTasksDto } from './dto/reorder-inbox-tasks.dto';
import { MoveTaskToInboxDto } from './dto/move-task-inbox.dto';
import {
  applyDueDateReschedule,
  buildNextInstance,
  findNextOccurrenceOnOrAfter,
  findOccupyingInstance,
  isOccurrenceOnSeries,
  seriesDueDate,
  retargetRecurrenceToDate,
} from './domain/recurrence.utils';
import { hasCrossedPomodoroTarget } from './domain/pomodoro.utils';
import { UserSettingsPort } from './domain/user-settings.port';
import { shiftToUserWallClock, shiftBackToUtc } from './lib/timezone';

function clonePomodoroConfig(src: PomodoroConfig): PomodoroConfig {
  const config = new PomodoroConfig();
  config.pomodoroCount = src.pomodoroCount;
  config.pomodoroDuration = src.pomodoroDuration;
  config.shortBreak = src.shortBreak;
  config.longBreak = src.longBreak;
  config.longBreakInterval = src.longBreakInterval;
  config.pomodoroCompleted = 0;
  return config;
}

export interface UpdateTaskResponse {
  task: Task;
  nextInstance?: Task;
  deletedInstanceId?: string;
}

export interface DeleteTaskResponse {
  deletedIds: string[];
  updated: Task[];
}

@Injectable()
export class TaskService {
  constructor(
    private readonly taskRepo: TaskRepositoryPort,
    private readonly userSettings: UserSettingsPort,
  ) {}

  async getAll(userId: number): Promise<Task[]> {
    return this.taskRepo.findAllByUser(userId);
  }

  async create(userId: number, dto: CreateTaskDto): Promise<Task> {
    const {
      isPomodoroTask,
      pomodoroCount,
      pomodoroDuration,
      shortBreak,
      longBreak,
      longBreakInterval,
      dueDate,
      deadline,
      checklist,
      recurrence,
      ...rest
    } = dto;

    const taskData: Partial<Task> = {
      ...rest,
      userId,
      dueDate: dueDate ? new Date(dueDate) : null,
      deadline: deadline ? new Date(deadline) : null,
      checklist: checklist ?? null,
      recurrence: recurrence ?? null,
    };

    if (isPomodoroTask) {
      const config = new PomodoroConfig();
      if (pomodoroCount !== undefined) config.pomodoroCount = pomodoroCount;
      if (pomodoroDuration !== undefined)
        config.pomodoroDuration = pomodoroDuration;
      if (shortBreak !== undefined) config.shortBreak = shortBreak;
      if (longBreak !== undefined) config.longBreak = longBreak;
      if (longBreakInterval !== undefined)
        config.longBreakInterval = longBreakInterval;
      taskData.pomodoroConfig = config;
    }

    return this.taskRepo.create(taskData);
  }

  async materializeOccurrence(
    userId: number,
    sourceId: string,
    dto: MaterializeOccurrenceDto,
  ): Promise<Task> {
    if (sourceId.includes('__virtual__')) {
      throw new BadRequestException(
        'Virtual task instances cannot be modified directly.',
      );
    }

    const source = await this.taskRepo.findById(sourceId, userId);
    if (!source) throw new NotFoundException(`Task #${sourceId} not found`);

    if (source.isOverdue) {
      throw new BadRequestException('Overdue task cannot be modified.');
    }
    if (!source.recurrence) {
      throw new BadRequestException(
        'Only recurring tasks can materialize occurrences.',
      );
    }

    const timezone = await this.userSettings.getTimezone(userId);
    const parentId = source.recurringParentId ?? source.id;
    const rootTask = source.recurringParentId
      ? await this.taskRepo.findById(parentId, userId)
      : source;
    const origin = seriesDueDate({
      dueDate: source.dueDate,
      recurrenceAnchorDate: source.recurrenceAnchorDate ?? null,
    });
    if (!origin) {
      throw new BadRequestException('Task has no series slot.');
    }

    const occurrenceUtc = new Date(dto.occurrenceDate);
    const originZoned = shiftToUserWallClock(origin, timezone);
    const occurrenceZoned = shiftToUserWallClock(occurrenceUtc, timezone);
    const rule = source.recurrence;
    if (!rule) {
      throw new BadRequestException(
        'Only recurring tasks can materialize occurrences.',
      );
    }
    const completedCount = rootTask?.recurringCompletedCount ?? 0;

    if (
      !isOccurrenceOnSeries(
        originZoned,
        rule,
        occurrenceZoned,
        completedCount,
      )
    ) {
      throw new BadRequestException(
        'occurrenceDate is not on the series schedule.',
      );
    }

    const members = await this.taskRepo.findByParentId(parentId, true);
    const occupying = this.findOccupyingMember(
      members,
      occurrenceZoned,
      timezone,
    );
    if (occupying) {
      throw new BadRequestException('This series slot is already occupied.');
    }

    const instanceData = buildNextInstance(source, occurrenceUtc, parentId);
    instanceData.isAutoCreated = false;
    if (source.pomodoroConfig) {
      (instanceData as any).pomodoroConfig = clonePomodoroConfig(
        source.pomodoroConfig,
      );
    }

    return this.taskRepo.create(instanceData);
  }

  async update(
    userId: number,
    id: string,
    dto: UpdateTaskDto,
  ): Promise<UpdateTaskResponse> {
    if (id.includes('__virtual__')) {
      throw new BadRequestException(
        'Virtual task instances cannot be modified directly.',
      );
    }

    const { dueDate, deadline, recurrence, rescheduleScope, ...rest } = dto;

    const task = await this.taskRepo.findById(id, userId);
    if (!task) throw new NotFoundException(`Task #${id} not found`);

    if (task.isOverdue) {
      throw new BadRequestException('Overdue task cannot be modified.');
    }

    // Detect recurring complete/uncomplete transitions
    const isCompletingRecurring =
      dto.completed === true && !task.completed && task.recurrence;

    const isUncompletingRecurring =
      dto.completed === false && task.completed && task.recurrence;

    // Apply only defined scalar fields (skip undefined to avoid clobbering existing values)
    const defined = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined),
    );
    Object.assign(task, defined);
    if (dueDate !== undefined) {
      const newDue = dueDate ? new Date(dueDate) : null;
      if ((rescheduleScope ?? 'this') === 'subsequent') {
        await this.retargetSubsequentRecurrence(task, newDue);
      }
      const next = applyDueDateReschedule(
        {
          dueDate: task.dueDate,
          recurrenceAnchorDate: task.recurrenceAnchorDate ?? null,
          recurrence: task.recurrence,
        },
        newDue,
        rescheduleScope ?? 'this',
      );
      task.dueDate = next.dueDate;
      task.recurrenceAnchorDate = next.recurrenceAnchorDate;
    } else if (rescheduleScope === 'subsequent') {
      await this.retargetSubsequentRecurrence(task, task.dueDate);
      task.recurrenceAnchorDate = null;
    }
    if (deadline !== undefined)
      task.deadline = deadline ? new Date(deadline) : null;
    if (recurrence !== undefined) task.recurrence = recurrence ?? null;

    // Content edits detach an auto-created row from "cursor" status.
    // dueDate / rescheduleScope keep it as the live series cursor.
    const isRescheduleUpdate =
      dto.rescheduleScope !== undefined || dueDate !== undefined;
    if (task.recurringParentId && !dto.completed && !isRescheduleUpdate) {
      task.isAutoCreated = false;
    }

    if (isCompletingRecurring) {
      return this.completeRecurringTask(userId, task);
    }

    if (isUncompletingRecurring) {
      return this.uncompleteRecurringTask(userId, task);
    }

    const saved = await this.taskRepo.save(task);
    return { task: saved };
  }

  private async retargetSubsequentRecurrence(
    task: Task,
    toUtc: Date | null,
  ): Promise<void> {
    const fromUtc = seriesDueDate({
      dueDate: task.dueDate,
      recurrenceAnchorDate: task.recurrenceAnchorDate ?? null,
    });
    if (!task.recurrence || !fromUtc || !toUtc) return;
    const timezone = await this.userSettings.getTimezone(task.userId);
    task.recurrence = retargetRecurrenceToDate(
      task.recurrence,
      shiftToUserWallClock(fromUtc, timezone),
      shiftToUserWallClock(toUtc, timezone),
    );
  }

  private findOccupyingMember(
    members: Task[],
    slotZoned: Date,
    timezone: string,
  ): Task | undefined {
    const zoned = members.map((member) => ({
      member,
      dueDate: member.dueDate
        ? shiftToUserWallClock(member.dueDate, timezone)
        : null,
      recurrenceAnchorDate: member.recurrenceAnchorDate
        ? shiftToUserWallClock(member.recurrenceAnchorDate, timezone)
        : null,
    }));
    const occupying = findOccupyingInstance(zoned, slotZoned);
    return occupying?.member;
  }

  private async completeRecurringTask(
    userId: number,
    task: Task,
  ): Promise<UpdateTaskResponse> {
    const parentId = task.recurringParentId ?? task.id;
    const uncompleted = await this.taskRepo.findByParentId(parentId, true);
    const siblings = uncompleted.filter((t) => t.id !== task.id);

    let nextInstance: Task | undefined;

    const seriesDue = seriesDueDate({
      dueDate: task.dueDate,
      recurrenceAnchorDate: task.recurrenceAnchorDate ?? null,
    });

    if (seriesDue && task.recurrence) {
      const timezone = await this.userSettings.getTimezone(userId);

      const rootTask = task.recurringParentId
        ? await this.taskRepo.findById(parentId, userId)
        : task;

      const completedCount = rootTask?.recurringCompletedCount ?? 0;
      const countAfterComplete = completedCount + 1;

      const nowLocal = shiftToUserWallClock(new Date(), timezone);
      const startOfTodayLocal = new Date(nowLocal);
      startOfTodayLocal.setUTCHours(0, 0, 0, 0);

      const zonedDue = shiftToUserWallClock(seriesDue, timezone);
      const nextZoned = findNextOccurrenceOnOrAfter(
        zonedDue,
        task.recurrence,
        startOfTodayLocal,
        countAfterComplete,
      );
      const nextDate = nextZoned ? shiftBackToUtc(nextZoned, timezone) : null;
      const occupying =
        nextZoned &&
        this.findOccupyingMember(siblings, nextZoned, timezone);

      if (occupying) {
        nextInstance = occupying;
        if (!occupying.isAutoCreated && rootTask) {
          rootTask.recurringCompletedCount = countAfterComplete;
          if (rootTask.id !== task.id) {
            await this.taskRepo.save(rootTask);
          } else {
            task.recurringCompletedCount = countAfterComplete;
          }
        }
      } else {
        if (nextDate) {
          const instanceData = buildNextInstance(task, nextDate, parentId);
          if (task.pomodoroConfig) {
            (instanceData as any).pomodoroConfig = clonePomodoroConfig(
              task.pomodoroConfig,
            );
          }
          nextInstance = await this.taskRepo.create(instanceData);
        }

        if (rootTask) {
          rootTask.recurringCompletedCount = countAfterComplete;
          if (rootTask.id !== task.id) {
            await this.taskRepo.save(rootTask);
          } else {
            task.recurringCompletedCount = countAfterComplete;
          }
        }
      }
    }

    task.completed = true;
    const saved = await this.taskRepo.save(task);
    return { task: saved, nextInstance };
  }

  private async uncompleteRecurringTask(
    userId: number,
    task: Task,
  ): Promise<UpdateTaskResponse> {
    const isRoot = task.recurringParentId === null;
    const parentId = task.recurringParentId ?? task.id;

    const uncompleted = await this.taskRepo.findByParentId(parentId, true);
    const nextInstance = uncompleted.find((t) => t.id !== task.id);

    // Snapshot count before disconnect — used to seed promoted root.
    const originalCount = task.recurringCompletedCount ?? 0;

    // Disconnect X from the series unconditionally.
    task.recurrence = null;
    task.recurringParentId = null;
    task.recurringCompletedCount = 0;
    task.isAutoCreated = false;
    task.completed = false;

    let promotedInstance: Task | undefined;

    if (isRoot && nextInstance) {
      nextInstance.recurringParentId = null;
      nextInstance.recurringCompletedCount = Math.max(0, originalCount - 1);
      nextInstance.isAutoCreated = false;
      promotedInstance = await this.taskRepo.save(nextInstance);
    } else if (!isRoot) {
      const rootTask = await this.taskRepo.findById(parentId, userId);
      if (rootTask) {
        rootTask.recurringCompletedCount = Math.max(
          0,
          (rootTask.recurringCompletedCount ?? 0) - 1,
        );
        await this.taskRepo.save(rootTask);
      }
    }

    const saved = await this.taskRepo.save(task);
    return { task: saved, nextInstance: promotedInstance };
  }

  async updatePomodoroConfig(
    userId: number,
    taskId: string,
    dto: UpdatePomodoroConfigDto | null,
  ): Promise<Task> {
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new NotFoundException(`Task #${taskId} not found`);
    return this.taskRepo.updatePomodoroConfig(task, dto);
  }

  async updateChecklist(
    userId: number,
    taskId: string,
    dto: UpdateChecklistDto,
  ): Promise<Task> {
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new NotFoundException(`Task #${taskId} not found`);
    return this.taskRepo.updateChecklist(task, { items: dto.items });
  }

  async incrementPomodoro(
    userId: number,
    taskId: string,
    increment: number,
  ): Promise<UpdateTaskResponse> {
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new NotFoundException(`Task #${taskId} not found`);

    const before = task.pomodoroConfig?.pomodoroCompleted ?? 0;
    const target = task.pomodoroConfig?.pomodoroCount ?? 0;

    await this.taskRepo.incrementPomodoroCompleted(taskId, increment);

    // Re-read for the authoritative counter: the increment is applied by SQL,
    // and the fresh value is what the client needs for its X/Y badge.
    const refreshed = (await this.taskRepo.findById(taskId, userId)) ?? task;
    const after = refreshed.pomodoroConfig?.pomodoroCompleted ?? before;

    // The increment is the primary effect — guard so auto-completion can never
    // throw on top of a counter that is already persisted.
    const shouldAutoComplete =
      !!task.pomodoroConfig &&
      !task.completed &&
      !task.isOverdue &&
      hasCrossedPomodoroTarget(before, after, target);

    if (shouldAutoComplete) {
      return this.update(userId, taskId, { completed: true });
    }

    return { task: refreshed };
  }

  async delete(userId: number, id: string): Promise<DeleteTaskResponse> {
    const task = await this.taskRepo.findById(id, userId);

    if (task && (task.recurrence || task.recurringParentId)) {
      return this.deleteRecurringFamilyMember(userId, task);
    }

    const deleted = await this.taskRepo.delete(id, userId);
    if (!deleted) throw new NotFoundException(`Task #${id} not found`);
    return { deletedIds: [id], updated: [] };
  }

  private async deleteRecurringFamilyMember(
    userId: number,
    task: Task,
  ): Promise<DeleteTaskResponse> {
    const parentId = task.recurringParentId ?? task.id;
    const family = await this.taskRepo.findByParentId(parentId, false);
    const liveOthers = family.filter((t) => !t.completed && t.id !== task.id);
    const isRoot = task.recurringParentId === null;
    const shouldEndSeries = isRoot || liveOthers.length === 0;

    if (!shouldEndSeries) {
      const deleted = await this.taskRepo.delete(task.id, userId);
      if (!deleted) throw new NotFoundException(`Task #${task.id} not found`);
      return { deletedIds: [task.id], updated: [] };
    }

    const live = family.filter((t) => !t.completed);
    const deletedIds = [...new Set([task.id, ...live.map((t) => t.id)])];

    await this.taskRepo.deleteByParentId(parentId, true);

    const leftover = await this.taskRepo.findByParentId(parentId, false);
    const updated: Task[] = [];
    for (const member of leftover) {
      if (member.id === task.id) continue;
      if (member.recurrence || member.recurringParentId) {
        member.recurrence = null;
        if (isRoot) member.recurringParentId = null;
        updated.push(await this.taskRepo.save(member));
      }
    }

    if (isRoot) {
      await this.taskRepo.clearParentId(parentId);
    }

    const alreadyDeleted =
      Boolean(task.recurringParentId) && !task.completed;
    if (!alreadyDeleted) {
      const deleted = await this.taskRepo.delete(task.id, userId);
      if (!deleted) throw new NotFoundException(`Task #${task.id} not found`);
    }

    return { deletedIds, updated };
  }

  async reorderInboxTasks(
    userId: number,
    dto: ReorderInboxTasksDto,
  ): Promise<{ ok: true; orderedIds: string[] }> {
    for (const id of dto.orderedIds) {
      const task = await this.taskRepo.findById(id, userId);
      if (!task) throw new NotFoundException(`Task #${id} not found`);
      if (task.projectId !== null) {
        throw new ForbiddenException(`Task #${id} is not an Inbox task`);
      }
    }

    const updates = dto.orderedIds.map((id, index) => ({ id, order: index }));
    await this.taskRepo.reorderTasks(updates);
    return { ok: true, orderedIds: dto.orderedIds };
  }

  async moveToInbox(
    userId: number,
    taskId: string,
    dto: MoveTaskToInboxDto,
  ): Promise<Task> {
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new NotFoundException(`Task #${taskId} not found`);

    let order: number;
    if (dto.order !== undefined) {
      order = dto.order;
    } else {
      const inboxTasks = await this.taskRepo.findAllByProject(userId, null);
      const maxOrder = inboxTasks.reduce(
        (max, t) => (t.order > max ? t.order : max),
        -1,
      );
      order = maxOrder + 1;
    }

    task.projectId = null;
    task.columnId = null;
    task.order = order;
    return this.taskRepo.save(task);
  }
}
