import type { TaskDependenciesResponse, TaskDependencyEdge } from '../model/task-dependencies'
import { api } from '@/api/client'

/** Загружает полный граф зависимостей текущего пользователя; ошибки API отклоняют промис. */
export const fetchTaskDependencies = () => api.get<TaskDependencyEdge[]>('/tasks/dependencies/graph')

/** Заменяет предшественников сохранённой задачи и возвращает канонический набор сервера. */
export function setTaskDependencies(taskId: string, dependencyIds: string[]) {
  return api.put<TaskDependenciesResponse>(`/tasks/${encodeURIComponent(taskId)}/dependencies`, { dependencyIds })
}
