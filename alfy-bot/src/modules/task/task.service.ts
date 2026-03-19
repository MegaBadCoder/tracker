import { Injectable, NotFoundException } from '@nestjs/common';
import { Task, PomodoroConfig } from '../../shared/entities';
import { TaskRepositoryPort } from './domain/task-repository.port';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { UpdatePomodoroConfigDto } from './dto/update-pomodoro-config.dto';

@Injectable()
export class TaskService {
  constructor(private readonly taskRepo: TaskRepositoryPort) {}

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
      ...rest
    } = dto;

    const taskData: Partial<Task> = {
      ...rest,
      userId,
      dueDate: dueDate ? new Date(dueDate) : null,
      deadline: deadline ? new Date(deadline) : null,
      checklist: checklist ?? null,
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

  async update(userId: number, id: string, dto: UpdateTaskDto): Promise<Task> {
    const { dueDate, deadline, ...rest } = dto;

    const task = await this.taskRepo.findById(id, userId);
    if (!task) throw new NotFoundException(`Task #${id} not found`);

    Object.assign(task, rest);
    if (dueDate !== undefined)
      task.dueDate = dueDate ? new Date(dueDate) : null;
    if (deadline !== undefined)
      task.deadline = deadline ? new Date(deadline) : null;

    return this.taskRepo.save(task);
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
  ): Promise<void> {
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new NotFoundException(`Task #${taskId} not found`);
    await this.taskRepo.incrementPomodoroCompleted(taskId, increment);
  }

  async delete(userId: number, id: string): Promise<void> {
    const deleted = await this.taskRepo.delete(id, userId);
    if (!deleted) throw new NotFoundException(`Task #${id} not found`);
  }
}
