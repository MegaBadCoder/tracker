import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Release } from '../../shared/entities';
import { ReleaseRepositoryPort } from './domain/release-repository.port';
import { ProjectRepositoryPort } from './domain/project-repository.port';
import { BoardGroupRepositoryPort } from './domain/board-group-repository.port';
import { CreateReleaseDto } from './dto/create-release.dto';
import { UpdateReleaseDto } from './dto/update-release.dto';
import { ReleaseReleaseDto } from './dto/release-release.dto';
import { AssignGroupReleaseDto } from './dto/assign-group-release.dto';

@Injectable()
export class ReleaseService {
  constructor(
    private readonly releaseRepo: ReleaseRepositoryPort,
    private readonly projectRepo: ProjectRepositoryPort,
    private readonly groupRepo: BoardGroupRepositoryPort,
  ) {}

  private assertDateOrder(
    startDate: string | null,
    releaseDate: string | null,
  ): void {
    if (startDate !== null && releaseDate !== null && startDate > releaseDate) {
      throw new BadRequestException('startDate must not be after releaseDate');
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

  private async getRelease(id: string, projectId: string): Promise<Release> {
    const release = await this.releaseRepo.findById(id, projectId);
    if (!release) throw new NotFoundException(`Release #${id} not found`);
    return release;
  }

  /**
   * Все релизы проекта по возрастанию `order`, включая выпущенные: они нужны
   * для подписи выпущенного релиза у задачи. Разделить их на блоки должен
   * вызывающий.
   */
  async list(userId: number, projectId: string): Promise<Release[]> {
    await this.validateProjectAccess(userId, projectId);
    return this.releaseRepo.findAllByProject(projectId);
  }

  /**
   * Создаёт релиз в статусе `planned`. `order` — на единицу больше
   * максимального среди `planned`-релизов, а без них — 0, то есть релиз
   * встаёт в конец очереди. Даты должны идти в порядке `startDate` ≤
   * `releaseDate`, иначе 400.
   */
  async create(
    userId: number,
    projectId: string,
    dto: CreateReleaseDto,
  ): Promise<Release> {
    await this.validateProjectAccess(userId, projectId);

    const startDate = dto.startDate ?? null;
    const releaseDate = dto.releaseDate ?? null;
    this.assertDateOrder(startDate, releaseDate);

    const existing = await this.releaseRepo.findAllByProject(projectId);
    const plannedOrders = existing
      .filter((r) => r.status === 'planned')
      .map((r) => r.order);

    return this.releaseRepo.create({
      userId,
      projectId,
      name: dto.name,
      description: dto.description ?? null,
      startDate,
      releaseDate,
      order: plannedOrders.length ? Math.max(...plannedOrders) + 1 : 0,
    });
  }

  /**
   * Правит имя, описание и даты. Выпущенный релиз менять нельзя (400). Даты
   * сверяются с уже сохранённой второй датой.
   */
  async update(
    userId: number,
    projectId: string,
    id: string,
    dto: UpdateReleaseDto,
  ): Promise<Release> {
    await this.validateProjectAccess(userId, projectId);
    const release = await this.getRelease(id, projectId);

    if (release.status === 'released') {
      throw new BadRequestException('Released release cannot be changed');
    }

    const startDate =
      dto.startDate !== undefined ? dto.startDate : release.startDate;
    const releaseDate =
      dto.releaseDate !== undefined ? dto.releaseDate : release.releaseDate;
    this.assertDateOrder(startDate, releaseDate);

    release.startDate = startDate;
    release.releaseDate = releaseDate;
    if (dto.name !== undefined) release.name = dto.name;
    if (dto.description !== undefined) release.description = dto.description;

    return this.releaseRepo.save(release);
  }

  /**
   * Выпускает релиз: закрывает его и переносит незавершённые задачи в
   * `planned`-релиз этого проекта (`moveTo` — его id) либо снимает с них
   * релиз (`moveTo = 'none'`). Выполненные задачи остаются в выпущенном
   * релизе, ни одна задача не удаляется. Выпустить можно только `planned`,
   * иначе 400. Возвращает выпущенный релиз.
   */
  async release(
    userId: number,
    projectId: string,
    id: string,
    dto: ReleaseReleaseDto,
  ): Promise<Release> {
    await this.validateProjectAccess(userId, projectId);
    const release = await this.getRelease(id, projectId);

    if (release.status !== 'planned') {
      throw new BadRequestException('Only a planned release can be released');
    }

    let moveToReleaseId: string | null = null;
    if (dto.moveTo !== 'none') {
      const target =
        dto.moveTo === id
          ? null
          : await this.releaseRepo.findById(dto.moveTo, projectId);
      if (!target || target.status !== 'planned') {
        throw new BadRequestException(
          'moveTo must be "none" or another planned release of this project',
        );
      }
      moveToReleaseId = target.id;
    }

    await this.releaseRepo.releaseAndMoveUnfinished(id, moveToReleaseId);
    return this.getRelease(id, projectId);
  }

  /** Удаляет релиз; его задачи не удаляются, а остаются без релиза. */
  async delete(userId: number, projectId: string, id: string): Promise<void> {
    await this.validateProjectAccess(userId, projectId);

    const deleted = await this.releaseRepo.delete(id, projectId);
    if (!deleted) throw new NotFoundException(`Release #${id} not found`);
  }

  /**
   * Назначает или снимает плановый релиз истории и её задач. Принимает UUID
   * релиза этого проекта либо null. Возвращает число изменённых задач;
   * чужая группа, эпик и выпущенный релиз дают 400.
   */
  async setGroupRelease(
    userId: number,
    projectId: string,
    groupId: string,
    releaseId: string | null,
  ): Promise<{ updated: number }> {
    await this.validateProjectAccess(userId, projectId);
    const group = await this.groupRepo.findById(groupId, projectId);
    if (!group || group.type !== 'story') {
      throw new BadRequestException(
        'Only a story of this project can have a release',
      );
    }
    if (group.releaseId) {
      const current = await this.getRelease(group.releaseId, projectId);
      if (current.status === 'released') {
        throw new BadRequestException('Released story cannot be reassigned');
      }
    }
    if (releaseId !== null) {
      const release = await this.getRelease(releaseId, projectId);
      if (release.status !== 'planned') {
        throw new BadRequestException(
          'Cannot assign a story to a released release',
        );
      }
    }
    const updated = await this.releaseRepo.setGroupRelease(
      projectId,
      [groupId],
      releaseId,
    );
    return { updated };
  }

  /**
   * Ставит релиз всем задачам группы проекта: для эпика — задачам самого эпика
   * и всех его историй, для истории — только её задачам. Группа должна быть
   * из этого проекта, а релиз — `planned`, иначе 400. Возвращает число
   * затронутых задач.
   */
  async assignGroup(
    userId: number,
    projectId: string,
    id: string,
    dto: AssignGroupReleaseDto,
  ): Promise<{ updated: number }> {
    await this.validateProjectAccess(userId, projectId);
    const release = await this.getRelease(id, projectId);

    if (release.status !== 'planned') {
      throw new BadRequestException(
        'Cannot assign a task to a released release',
      );
    }

    const group = await this.groupRepo.findById(dto.groupId, projectId);
    if (!group) {
      throw new BadRequestException('Group does not belong to this project');
    }

    const groupIds = [group.id];
    if (group.type === 'epic') {
      const all = await this.groupRepo.findAllByProject(projectId);
      for (const g of all) {
        if (g.parentId === group.id) groupIds.push(g.id);
      }
    }

    const updated = await this.releaseRepo.assignGroupTasks(id, groupIds);
    return { updated };
  }
}
