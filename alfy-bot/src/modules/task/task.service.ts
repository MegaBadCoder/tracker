import { Injectable, NotFoundException } from '@nestjs/common';
import { Task, PomodoroConfig } from '../../shared/entities';
import { TaskRepositoryPort } from './domain/task-repository.port';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

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
      ...rest
    } = dto;

    const taskData: Partial<Task> = {
      ...rest,
      userId,
      dueDate: dueDate ? new Date(dueDate) : null,
      deadline: deadline ? new Date(deadline) : null,
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
    const {
      isPomodoroTask,
      pomodoroCount,
      pomodoroDuration,
      shortBreak,
      longBreak,
      longBreakInterval,
      pomodoroCompleted,
      dueDate,
      deadline,
      ...rest
    } = dto;

    const task = await this.taskRepo.findById(id, userId);
    if (!task) throw new NotFoundException(`Task #${id} not found`);

    const updateData: Partial<Task> = { ...rest };
    if (dueDate !== undefined)
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (deadline !== undefined)
      updateData.deadline = deadline ? new Date(deadline) : null;

    if (isPomodoroTask === true && !task.pomodoroConfig) {
      const config = new PomodoroConfig();
      if (pomodoroCount !== undefined) config.pomodoroCount = pomodoroCount;
      if (pomodoroDuration !== undefined)
        config.pomodoroDuration = pomodoroDuration;
      if (shortBreak !== undefined) config.shortBreak = shortBreak;
      if (longBreak !== undefined) config.longBreak = longBreak;
      if (longBreakInterval !== undefined)
        config.longBreakInterval = longBreakInterval;
      updateData.pomodoroConfig = config;
    } else if (isPomodoroTask === false && task.pomodoroConfig) {
      updateData.pomodoroConfig = null;
    } else if (task.pomodoroConfig) {
      if (pomodoroCount !== undefined)
        task.pomodoroConfig.pomodoroCount = pomodoroCount;
      if (pomodoroDuration !== undefined)
        task.pomodoroConfig.pomodoroDuration = pomodoroDuration;
      if (shortBreak !== undefined)
        task.pomodoroConfig.shortBreak = shortBreak;
      if (longBreak !== undefined) task.pomodoroConfig.longBreak = longBreak;
      if (longBreakInterval !== undefined)
        task.pomodoroConfig.longBreakInterval = longBreakInterval;
      if (pomodoroCompleted !== undefined)
        task.pomodoroConfig.pomodoroCompleted = pomodoroCompleted;
    }

    return this.taskRepo.update(id, userId, updateData);
  }

  async updatePomodoro(
    userId: number,
    id: string,
    pomodoroCompleted: number,
  ): Promise<Task> {
    const task = await this.taskRepo.findById(id, userId);
    if (!task) throw new NotFoundException(`Task #${id} not found`);
    if (!task.pomodoroConfig)
      throw new NotFoundException(`Task #${id} has no pomodoro config`);

    task.pomodoroConfig.pomodoroCompleted = pomodoroCompleted;
    return this.taskRepo.update(id, userId, {});
  }

  async delete(userId: number, id: string): Promise<void> {
    return this.taskRepo.delete(id, userId);
  }
}
