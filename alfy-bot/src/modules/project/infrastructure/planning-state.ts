import { EntityManager } from 'typeorm';
import type { PlanningUndoState } from '../../../shared/entities/planning-undo.entity';

async function rows(
  manager: EntityManager,
  table: 'tasks' | 'board_groups',
  ids: string[],
): Promise<Record<string, unknown>[]> {
  if (!ids.length) return [];
  return manager.query(
    `SELECT * FROM ${table} WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id`,
    ids,
  );
}

/** Снимает точное состояние затронутых строк и состава историй для безопасной одноразовой отмены. */
export async function planningState(
  manager: EntityManager,
  taskIds: string[],
  storyIds: string[],
): Promise<PlanningUndoState> {
  const storyTasks: { id: string }[] = storyIds.length
    ? await manager.query(
        `SELECT id FROM tasks WHERE groupId IN (${storyIds.map(() => '?').join(',')}) ORDER BY id`,
        storyIds,
      )
    : [];
  return {
    tasks: await rows(manager, 'tasks', taskIds),
    stories: await rows(manager, 'board_groups', storyIds),
    storyTaskIds: storyTasks.map((t) => t.id),
  };
}
