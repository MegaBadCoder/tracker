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
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { UpdatePomodoroConfigDto } from './dto/update-pomodoro-config.dto';
import { ReorderInboxTasksDto } from './dto/reorder-inbox-tasks.dto';
import { MoveTaskToInboxDto } from './dto/move-task-inbox.dto';
import {
  buildNextInstance,
  findNextOccurrenceOnOrAfter,
} from './domain/recurrence.utils';
import { hasCrossedPomodoroTarget } from './domain/pomodoro.utils';
import { UserSettingsPort } from './domain/user-settings.port';
import { shiftToUserWallClock, shiftBackToUtc } from './lib/timezone';

export interface UpdateTaskResponse {
  task: Task;
  nextInstance?: Task;
  deletedInstanceId?: string;
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

    const { dueDate, deadline, recurrence, ...rest } = dto;

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
    if (dueDate !== undefined)
      task.dueDate = dueDate ? new Date(dueDate) : null;
    if (deadline !== undefined)
      task.deadline = deadline ? new Date(deadline) : null;
    if (recurrence !== undefined) task.recurrence = recurrence ?? null;

    // Mark user-modified instances as not auto-created
    if (task.recurringParentId && !dto.completed) {
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

  private async completeRecurringTask(
    userId: number,
    task: Task,
  ): Promise<UpdateTaskResponse> {
    const parentId = task.recurringParentId ?? task.id;

    // Idempotency: check if next instance already exists
    const uncompleted = await this.taskRepo.findByParentId(parentId, true);
    const existingNext = uncompleted.find((t) => t.id !== task.id);

    if (existingNext) {
      task.completed = true;
      const saved = await this.taskRepo.save(task);
      return { task: saved, nextInstance: existingNext };
    }

    // Compute next due date
    let nextInstance: Task | undefined;

    if (task.dueDate && task.recurrence) {
      const timezone = await this.userSettings.getTimezone(userId);

      // Get the root task for completedCount
      const rootTask = task.recurringParentId
        ? await this.taskRepo.findById(parentId, userId)
        : task;

      const completedCount = rootTask?.recurringCompletedCount ?? 0;
      const countAfterComplete = completedCount + 1;

      const nowLocal = shiftToUserWallClock(new Date(), timezone);
      const startOfTodayLocal = new Date(nowLocal);
      startOfTodayLocal.setUTCHours(0, 0, 0, 0);

      // Shift to user's wall clock so domain sees correct calendar day
      const zonedDue = shiftToUserWallClock(task.dueDate, timezone);
      const nextZoned = findNextOccurrenceOnOrAfter(
        zonedDue,
        task.recurrence,
        startOfTodayLocal,
        countAfterComplete,
      );
      const nextDate = nextZoned ? shiftBackToUtc(nextZoned, timezone) : null;

      if (nextDate) {
        const instanceData = buildNextInstance(task, nextDate, parentId);

        // Copy pomodoroConfig (cascade entity, not a domain concern)
        if (task.pomodoroConfig) {
          const config = new PomodoroConfig();
          config.pomodoroCount = task.pomodoroConfig.pomodoroCount;
          config.pomodoroDuration = task.pomodoroConfig.pomodoroDuration;
          config.shortBreak = task.pomodoroConfig.shortBreak;
          config.longBreak = task.pomodoroConfig.longBreak;
          config.longBreakInterval = task.pomodoroConfig.longBreakInterval;
          config.pomodoroCompleted = 0;
          (instanceData as any).pomodoroConfig = config;
        }

        nextInstance = await this.taskRepo.create(instanceData);
      }

      // Increment completed count on root
      if (rootTask) {
        rootTask.recurringCompletedCount = completedCount + 1;
        if (rootTask.id !== task.id) {
          await this.taskRepo.save(rootTask);
        } else {
          task.recurringCompletedCount = completedCount + 1;
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

  async delete(userId: number, id: string): Promise<void> {
    const task = await this.taskRepo.findById(id, userId);

    // Cascade for recurring root tasks
    if (task?.recurrence && !task.recurringParentId) {
      await this.taskRepo.deleteByParentId(task.id, true);
      await this.taskRepo.clearParentId(task.id);
    }

    const deleted = await this.taskRepo.delete(id, userId);
    if (!deleted) throw new NotFoundException(`Task #${id} not found`);
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
