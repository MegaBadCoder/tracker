import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Project, Sprint } from '../../../shared/entities';

/** Возвращает доступный agile-проект; чужие и отсутствующие проекты не раскрывает. */
export async function planningProject(
  manager: EntityManager,
  userId: number,
  projectId: string,
): Promise<Project> {
  const project = await manager.findOneBy(Project, { id: projectId, userId });
  if (!project) throw new NotFoundException('Проект не найден');
  if (project.type !== 'agile')
    throw new BadRequestException('Планирование доступно для agile-проектов');
  return project;
}

/** Проверяет, что назначение принадлежит проекту и допускает изменение; null обозначает бэклог. */
export async function mutableSprint(
  manager: EntityManager,
  projectId: string,
  sprintId: string | null,
): Promise<Sprint | null> {
  if (sprintId === null) return null;
  const sprint = await manager.findOneBy(Sprint, { id: sprintId, projectId });
  if (!sprint || sprint.status === 'closed')
    throw new BadRequestException('Нужен незакрытый спринт этого проекта');
  return sprint;
}
