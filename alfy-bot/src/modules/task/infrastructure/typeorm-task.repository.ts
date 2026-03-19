import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string, userId: number): Promise<Task | null> {
    return this.taskRepo.findOne({
      where: { id, userId },
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
}
