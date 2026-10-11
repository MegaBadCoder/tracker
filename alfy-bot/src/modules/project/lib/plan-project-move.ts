import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Project } from '../../../shared/entities';

function validateParent(projects: Project[], id: string, parentId: string | null) {
  const byId = new Map(projects.map(project => [project.id, project]));
  const visited = new Set([id]);
  let current = parentId;
  while (current !== null) {
    if (visited.has(current)) throw new BadRequestException('Project hierarchy cannot contain cycles');
    visited.add(current);
    const parent = byId.get(current);
    if (!parent) throw new NotFoundException('Parent project not found');
    current = parent.parentId;
  }
}

/** Возвращает копию дерева с новым родителем и порядком; null в beforeId означает конец уровня. Отклоняет циклы и неизвестные идентификаторы. */
export function planProjectMove(projects: Project[], id: string, parentId: string | null, beforeId: string | null): Project[] {
  const source = projects.find(project => project.id === id);
  if (!source) throw new NotFoundException('Project not found');
  validateParent(projects, id, parentId);
  const siblings = projects.filter(project => project.parentId === parentId && project.id !== id)
    .sort((a, b) => a.order - b.order);
  const index = beforeId === null ? siblings.length : siblings.findIndex(project => project.id === beforeId);
  if (index < 0) throw new BadRequestException('Target sibling not found at destination');
  siblings.splice(index, 0, { ...source, parentId });
  const orders = new Map(siblings.map((project, order) => [project.id, order]));
  return projects.map(project => orders.has(project.id)
    ? { ...project, parentId, order: orders.get(project.id)! }
    : { ...project });
}
