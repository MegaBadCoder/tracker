import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, PomodoroConfig } from '../../../shared/entities';
import { TaskRepositoryPort } from '../domain/task-repository.port';

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

  async update(
    id: string,
    userId: number,
    data: Partial<Task>,
  ): Promise<Task> {
    const task = await this.findById(id, userId);
    if (!task) throw new NotFoundException(`Task #${id} not found`);

    Object.assign(task, data);
    return this.taskRepo.save(task);
  }

  async delete(id: string, userId: number): Promise<void> {
    const task = await this.findById(id, userId);
    if (!task) throw new NotFoundException(`Task #${id} not found`);
    await this.taskRepo.remove(task);
  }
}
