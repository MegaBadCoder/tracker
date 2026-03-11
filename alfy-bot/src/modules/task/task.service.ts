import { Injectable, NotFoundException } from '@nestjs/common';
import { Task, PomodoroConfig } from '../../shared/entities';
import { TaskRepositoryPort } from './domain/task-repository.port';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

/**
 * Сервис управления задачами и помодоро-конфигурацией.
 * Делегирует персистентность в {@link TaskRepositoryPort}.
 */
@Injectable()
export class TaskService {
  constructor(private readonly taskRepo: TaskRepositoryPort) {}

  /**
   * Возвращает все задачи пользователя.
   *
   * @param userId - ID пользователя
   * @returns Список задач
   */
  async getAll(userId: number): Promise<Task[]> {
    return this.taskRepo.findAllByUser(userId);
  }

  /**
   * Создаёт новую задачу.
   * При `isPomodoroTask: true` инициализирует {@link PomodoroConfig}.
   *
   * @param userId - ID пользователя
   * @param dto - Данные для создания задачи
   * @returns Созданная задача
   */
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

  /**
   * Обновляет задачу по ID.
   * Добавляет/удаляет помодоро-конфиг в зависимости от `isPomodoroTask`.
   *
   * @param userId - ID пользователя (владельца задачи)
   * @param id - ID задачи
   * @param dto - Частичные данные для обновления
   * @returns Обновлённая задача
   * @throws {NotFoundException} Если задача не найдена
   */
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
      if (shortBreak !== undefined) task.pomodoroConfig.shortBreak = shortBreak;
      if (longBreak !== undefined) task.pomodoroConfig.longBreak = longBreak;
      if (longBreakInterval !== undefined)
        task.pomodoroConfig.longBreakInterval = longBreakInterval;
      if (pomodoroCompleted !== undefined)
        task.pomodoroConfig.pomodoroCompleted = pomodoroCompleted;
    }

    return this.taskRepo.update(id, userId, updateData);
  }

  /**
   * Увеличивает счётчик завершённых помодоро у задачи.
   *
   * @param taskId - ID задачи
   * @param increment - На сколько увеличить (обычно 1)
   */
  async incrementPomodoro(taskId: string, increment: number): Promise<void> {
    await this.taskRepo.incrementPomodoroCompleted(taskId, increment);
  }

  /**
   * Удаляет задачу.
   *
   * @param userId - ID пользователя (владельца)
   * @param id - ID задачи
   */
  async delete(userId: number, id: string): Promise<void> {
    return this.taskRepo.delete(id, userId);
  }
}
