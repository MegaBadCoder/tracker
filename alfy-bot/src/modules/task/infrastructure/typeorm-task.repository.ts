import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { Task, PomodoroConfig } from '../../../shared/entities';
import {
  TaskRepositoryPort,
  ChecklistData,
} from '../domain/task-repository.port';

@Injectable()
export class TypeOrmTaskRepository extends TaskRepositoryPort {
  constructor(
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
    @InjectRepository(PomodoroConfig)
    private pomodoroRepo: Repository<PomodoroConfig>,
  ) {
    super();
  }

  async findAllByUser(userId: number): Promise<Task[]> {
    return this.taskRepo.find({
      where: { userId },
      relations: ['pomodoroConfig'],
      order: { order: 'ASC', createdAt: 'DESC' },
    });
  }

  async findById(id: string, userId: number): Promise<Task | null> {
    return this.taskRepo.findOne({
      where: { id, userId },
      relations: ['pomodoroConfig'],
    });
  }

  async findByIds(userId: number, ids: string[]): Promise<Task[]> {
    if (ids.length === 0) return [];
    return this.taskRepo.find({
      where: { userId, id: In(ids) },
      relations: ['pomodoroConfig'],
    });
  }

  async create(task: Partial<Task>): Promise<Task> {
    const entity = this.taskRepo.create(task);
    return this.taskRepo.save(entity);
  }

  async save(task: Task): Promise<Task> {
    return this.taskRepo.save(task);
  }

  async update(
    id: string,
    userId: number,
    data: Partial<Task>,
  ): Promise<Task | null> {
    const task = await this.findById(id, userId);
    if (!task) return null;

    Object.assign(task, data);
    return this.taskRepo.save(task);
  }

  async delete(id: string, userId: number): Promise<boolean> {
    const task = await this.findById(id, userId);
    if (!task) return false;
    await this.taskRepo.remove(task);
    return true;
  }

  async incrementPomodoroCompleted(
    taskId: string,
    increment: number,
  ): Promise<void> {
    await this.pomodoroRepo.increment(
      { taskId },
      'pomodoroCompleted',
      increment,
    );
  }

  async updateChecklist(task: Task, data: ChecklistData): Promise<Task> {
    task.checklist = data;
    return this.taskRepo.save(task);
  }

  async updatePomodoroConfig(
    task: Task,
    data: Partial<PomodoroConfig> | null,
  ): Promise<Task> {
    if (data === null) {
      if (task.pomodoroConfig) {
        await this.pomodoroRepo.remove(task.pomodoroConfig);
        task.pomodoroConfig = null;
      }
    } else if (task.pomodoroConfig) {
      Object.assign(task.pomodoroConfig, data);
      await this.pomodoroRepo.save(task.pomodoroConfig);
    } else {
      const config = this.pomodoroRepo.create({ ...data, taskId: task.id });
      task.pomodoroConfig = await this.pomodoroRepo.save(config);
    }
    return task;
  }

  async findAllByProject(
    userId: number,
    projectId: string | null,
  ): Promise<Task[]> {
    return this.taskRepo.find({
      where: { userId, projectId: projectId === null ? IsNull() : projectId },
      relations: ['pomodoroConfig'],
      order: { order: 'ASC', createdAt: 'DESC' },
    });
  }

  async updatePosition(
    taskId: string,
    userId: number,
    projectId: string | null,
    columnId: string | null,
    order: number,
  ): Promise<Task | null> {
    const task = await this.findById(taskId, userId);
    if (!task) return null;
    task.projectId = projectId;
    task.columnId = columnId;
    task.order = order;
    return this.taskRepo.save(task);
  }

  async reorderTasks(updates: { id: string; order: number }[]): Promise<void> {
    await Promise.all(
      updates.map(({ id, order }) => this.taskRepo.update(id, { order })),
    );
  }

  async findByParentId(
    parentId: string,
    onlyUncompleted: boolean,
  ): Promise<Task[]> {
    const where = onlyUncompleted
      ? [
          {
            recurringParentId: parentId,
            completed: false,
            isOverdue: false,
          },
          { id: parentId, completed: false, isOverdue: false },
        ]
      : [
          { recurringParentId: parentId, isOverdue: false },
          { id: parentId, isOverdue: false },
        ];

    return this.taskRepo.find({
      where,
      relations: ['pomodoroConfig'],
    });
  }

  async deleteByParentId(
    parentId: string,
    onlyUncompleted: boolean,
  ): Promise<void> {
    if (onlyUncompleted) {
      await this.taskRepo.delete({
        recurringParentId: parentId,
        completed: false,
      });
    } else {
      await this.taskRepo.delete({ recurringParentId: parentId });
    }
  }

  async clearParentId(parentId: string): Promise<void> {
    await this.taskRepo.update(
      { recurringParentId: parentId },
      { recurringParentId: null },
    );
  }

  async findOverdueRecurringCandidates(
    userId: number,
    dueBeforeUtc: Date,
  ): Promise<Task[]> {
    return this.taskRepo.find({
      where: {
        userId,
        recurrence: Not(IsNull()),
        completed: false,
        isOverdue: false,
        dueDate: LessThan(dueBeforeUtc),
      },
      relations: ['pomodoroConfig'],
    });
  }

  async freezeAndCreateNext(
    oldTaskId: string,
    nextInstance: Partial<Task> | null,
  ): Promise<Task | null> {
    return this.taskRepo.manager.transaction(async (tx) => {
      await tx.update(Task, oldTaskId, {
        isOverdue: true,
        recurrence: null,
      });
      if (!nextInstance) return null;
      const created = tx.create(Task, nextInstance);
      return tx.save(created);
    });
  }
}
