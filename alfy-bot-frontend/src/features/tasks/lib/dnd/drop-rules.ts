import type { ProjectType } from '@/features/projects/model/types'

/**
 * Тип цели переноса задачи: тип проекта-приёмника или Входящие.
 */
export type DropTargetProjectType = ProjectType | 'inbox'

/**
 * Решает, разрешён ли перенос задачи с источника заданного типа на цель заданного типа.
 *
 * `sourceProjectType` — тип проекта, которому сейчас принадлежит задача,
 * либо `null`, если задача лежит во Входящих.
 *
 * Задача из agile-проекта может уйти только в другой agile-проект — ни в
 * обычный проект, ни во Входящие. Все остальные переносы (из обычного
 * проекта и из Входящих) разрешены на любую цель.
 */
export function canDropTask(
  sourceProjectType: ProjectType | null,
  targetType: DropTargetProjectType,
): boolean {
  if (sourceProjectType === 'agile') {
    return targetType === 'agile'
  }
  return true
}
