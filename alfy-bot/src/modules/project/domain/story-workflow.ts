import type { BoardGroup } from '../../../shared/entities/board-group.entity';
import type {
  Project,
  StoryWorkflowStatus,
} from '../../../shared/entities/project.entity';

export type {
  StoryWorkflowCategory,
  StoryWorkflowStatus,
} from '../../../shared/entities/project.entity';

export const INITIAL_STORY_WORKFLOW: readonly StoryWorkflowStatus[] = [
  { id: 'open', name: 'К проработке', category: 'open', color: '#64748b' },
  { id: 'ready', name: 'Готова к работе', category: 'ready', color: '#0284c7' },
  {
    id: 'in_progress',
    name: 'В работе',
    category: 'in_progress',
    color: '#d97706',
  },
  { id: 'review', name: 'На проверке', category: 'review', color: '#9333ea' },
  { id: 'done', name: 'Выполнена', category: 'done', color: '#16a34a' },
];

/** Возвращает независимую копию каталога проекта или начального каталога старого проекта. */
export function storyWorkflow(
  project: Pick<Project, 'storyWorkflow'>,
): StoryWorkflowStatus[] {
  return (project.storyWorkflow ?? INITIAL_STORY_WORKFLOW).map((status) => ({
    ...status,
  }));
}

/** Возвращает статус истории; старый open/done сопоставляется с первым статусом соответствующей категории. */
export function storyStatusId(
  group: Pick<BoardGroup, 'workflowStatusId' | 'status'>,
  statuses: StoryWorkflowStatus[],
): string {
  if (group.workflowStatusId) return group.workflowStatusId;
  const status = statuses.find((item) => item.category === group.status);
  if (!status)
    throw new Error('Каталог историй не содержит обязательной категории');
  return status.id;
}

/** Нормализует новые поля старой группы для ответа API, не изменяя исходный объект. */
export function normalizeStoryGroup<T extends BoardGroup>(
  group: T,
  statuses: StoryWorkflowStatus[],
): T {
  return {
    ...group,
    workflowStatusId:
      group.type === 'story' ? storyStatusId(group, statuses) : null,
    blockedReason: group.blockedReason ?? null,
    deferredUntil: group.deferredUntil ?? null,
    archived: group.archived ?? false,
    dependencyIds: [...(group.dependencyIds ?? [])],
  };
}

/** Возвращает причину недопустимости каталога; null означает, что существующие истории сохранят смысл статуса. */
export function workflowIssue(
  statuses: StoryWorkflowStatus[],
  previous: StoryWorkflowStatus[],
  groups: BoardGroup[],
): string | null {
  if (!Array.isArray(statuses) || statuses.length === 0)
    return 'Каталог статусов не может быть пустым';
  const ids = new Set(statuses.map((status) => status.id));
  if (ids.size !== statuses.length)
    return 'Идентификаторы статусов должны быть уникальны';
  if (
    !statuses.some((status) => status.category === 'open') ||
    !statuses.some((status) => status.category === 'done')
  ) {
    return 'Нужны статусы категорий open и done';
  }
  for (const group of groups.filter((group) => group.type === 'story')) {
    const id = storyStatusId(group, previous);
    const oldStatus = previous.find((status) => status.id === id);
    const nextStatus = statuses.find((status) => status.id === id);
    if (!nextStatus) return 'Нельзя удалить статус, используемый историей';
    if (oldStatus?.category !== nextStatus.category)
      return 'Нельзя изменить категорию используемого статуса';
  }
  return null;
}

/** Возвращает причину недопустимости зависимостей истории: дубликаты, чужие элементы или цикл. */
export function dependencyIssue(
  id: string,
  dependencies: string[],
  groups: BoardGroup[],
): string | null {
  if (!Array.isArray(dependencies)) return 'Зависимости должны быть массивом';
  if (new Set(dependencies).size !== dependencies.length)
    return 'Зависимости не должны повторяться';
  const stories = new Map(
    groups
      .filter((group) => group.type === 'story')
      .map((group) => [group.id, group]),
  );
  if (
    dependencies.some(
      (dependency) => dependency === id || !stories.has(dependency),
    )
  ) {
    return 'Зависимость должна ссылаться на другую историю этого проекта';
  }
  const reaches = (current: string, visited: Set<string>): boolean => {
    if (current === id) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    return (stories.get(current)?.dependencyIds ?? []).some((next) =>
      reaches(next, visited),
    );
  };
  return dependencies.some((dependency) => reaches(dependency, new Set()))
    ? 'Зависимости не должны образовывать цикл'
    : null;
}
