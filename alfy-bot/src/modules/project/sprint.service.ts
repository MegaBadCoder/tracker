import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Sprint } from '../../shared/entities';
import { SprintRepositoryPort } from './domain/sprint-repository.port';
import { ProjectRepositoryPort } from './domain/project-repository.port';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { StartSprintDto } from './dto/start-sprint.dto';
import { CompleteSprintDto } from './dto/complete-sprint.dto';

@Injectable()
export class SprintService {
  constructor(
    private readonly sprintRepo: SprintRepositoryPort,
    private readonly projectRepo: ProjectRepositoryPort,
  ) {}

  private assertDateOrder(
    startDate: string | null,
    endDate: string | null,
  ): void {
    if (startDate !== null && endDate !== null && startDate > endDate) {
      throw new BadRequestException('startDate must not be after endDate');
    }
  }

  private async validateProjectAccess(userId: number, projectId: string) {
    const project = await this.projectRepo.findById(projectId, userId);
    if (!project)
      throw new NotFoundException(`Project #${projectId} not found`);
    if (project.userId !== userId)
      throw new ForbiddenException('Project belongs to another user');
    return project;
  }

  private async getSprint(id: string, projectId: string): Promise<Sprint> {
    const sprint = await this.sprintRepo.findById(id, projectId);
    if (!sprint) throw new NotFoundException(`Sprint #${id} not found`);
    return sprint;
  }

  /**
   * Все спринты проекта по возрастанию `order`, включая закрытые: они нужны
   * для подписи закрытого спринта у задачи. Отфильтровать незакрытые для
   * экрана планирования должен вызывающий.
   */
  async list(userId: number, projectId: string): Promise<Sprint[]> {
    await this.validateProjectAccess(userId, projectId);
    return this.sprintRepo.findAllByProject(projectId);
  }

  /**
   * Создаёт спринт в статусе `planned`. Имя по умолчанию — «Спринт N», где N —
   * число всех спринтов проекта (с закрытыми) плюс один; `order` — число
   * незакрытых спринтов, то есть спринт встаёт в конец очереди планирования.
   */
  async create(
    userId: number,
    projectId: string,
    dto: CreateSprintDto,
  ): Promise<Sprint> {
    await this.validateProjectAccess(userId, projectId);

    const existing = await this.sprintRepo.findAllByProject(projectId);
    const open = existing.filter((s) => s.status !== 'closed');

    return this.sprintRepo.create({
      userId,
      projectId,
      name: dto.name ?? `Спринт ${existing.length + 1}`,
      goal: dto.goal ?? null,
      order: open.length,
    });
  }

  /**
   * Правит имя, цель и даты. Закрытый спринт менять нельзя (400). Даты
   * сверяются с уже сохранённой второй датой.
   */
  async update(
    userId: number,
    projectId: string,
    id: string,
    dto: UpdateSprintDto,
  ): Promise<Sprint> {
    await this.validateProjectAccess(userId, projectId);
    const sprint = await this.getSprint(id, projectId);

    if (sprint.status === 'closed') {
      throw new BadRequestException('Closed sprint cannot be changed');
    }

    const startDate =
      dto.startDate !== undefined ? dto.startDate : sprint.startDate;
    const endDate = dto.endDate !== undefined ? dto.endDate : sprint.endDate;
    this.assertDateOrder(startDate, endDate);

    sprint.startDate = startDate;
    sprint.endDate = endDate;
    if (dto.name !== undefined) sprint.name = dto.name;
    if (dto.goal !== undefined) sprint.goal = dto.goal;

    return this.sprintRepo.save(sprint);
  }

  /**
   * Запускает спринт: `planned` → `active` с обязательными датами и
   * необязательной целью. 400, если спринт не `planned` или в проекте уже
   * есть активный.
   */
  async start(
    userId: number,
    projectId: string,
    id: string,
    dto: StartSprintDto,
  ): Promise<Sprint> {
    await this.validateProjectAccess(userId, projectId);
    const sprint = await this.getSprint(id, projectId);

    if (sprint.status !== 'planned') {
      throw new BadRequestException('Only a planned sprint can be started');
    }
    this.assertDateOrder(dto.startDate, dto.endDate);

    const active = await this.sprintRepo.findActive(projectId);
    if (active) {
      throw new BadRequestException('Another sprint is already active');
    }

    sprint.status = 'active';
    sprint.startDate = dto.startDate;
    sprint.endDate = dto.endDate;
    if (dto.goal !== undefined) sprint.goal = dto.goal;

    return this.sprintRepo.save(sprint);
  }

  /**
   * Завершает активный спринт: закрывает его и переносит незавершённые задачи
   * в бэклог (`moveTo = 'backlog'`) или в `planned`-спринт этого проекта.
   * Выполненные задачи остаются в закрытом спринте, ни одна задача не
   * удаляется. Возвращает закрытый спринт.
   */
  async complete(
    userId: number,
    projectId: string,
    id: string,
    dto: CompleteSprintDto,
  ): Promise<Sprint> {
    await this.validateProjectAccess(userId, projectId);
    const sprint = await this.getSprint(id, projectId);

    if (sprint.status !== 'active') {
      throw new BadRequestException('Only an active sprint can be completed');
    }

    let moveToSprintId: string | null = null;
    if (dto.moveTo !== 'backlog') {
      const target = await this.sprintRepo.findById(dto.moveTo, projectId);
      if (!target || target.status !== 'planned') {
        throw new BadRequestException(
          'moveTo must be "backlog" or a planned sprint of this project',
        );
      }
      moveToSprintId = target.id;
    }

    await this.sprintRepo.closeAndMoveUnfinished(id, moveToSprintId);
    return this.getSprint(id, projectId);
  }

  /** Удаляет спринт; его задачи не удаляются, а уходят в бэклог. */
  async delete(userId: number, projectId: string, id: string): Promise<void> {
    await this.validateProjectAccess(userId, projectId);

    const deleted = await this.sprintRepo.delete(id, projectId);
    if (!deleted) throw new NotFoundException(`Sprint #${id} not found`);
  }
}
