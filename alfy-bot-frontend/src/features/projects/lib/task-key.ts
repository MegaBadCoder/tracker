import type { Project } from '../model/types'
import type { Task } from '@/features/tasks/model/types'

/**
 * Ключ задачи вида `ALF-12`: префикс проекта и номер задачи.
 * Возвращает `null`, если проекта нет, он не agile, префикс не задан или у задачи нет номера.
 */
export function taskKey(
  project: Pick<Project, 'type' | 'taskKeyPrefix'> | undefined,
  task: Pick<Task, 'number'>,
): string | null {
  if (project?.type !== 'agile' || !project.taskKeyPrefix)
    return null
  if (typeof task.number !== 'number')
    return null
  return `${project.taskKeyPrefix}-${task.number}`
}

const TASK_KEY_PREFIX_CHARS = /^[A-Z0-9]+$/

/**
 * Признак заведомо неверного префикса: не пустая строка с символами вне `A-Z0-9`
 * или длиннее 10. Точное правило (в том числе «начинается с буквы») проверяет сервер.
 */
export function isObviouslyInvalidTaskKeyPrefix(value: string): boolean {
  const prefix = value.trim()
  if (prefix.length === 0)
    return false
  return prefix.length > 10 || !TASK_KEY_PREFIX_CHARS.test(prefix)
}
