/** Связь сохранённых задач: taskId зависит от предшественника dependencyId. */
export interface TaskDependencyEdge {
  taskId: string
  dependencyId: string
}

/** Канонический набор идентификаторов предшественников одной задачи. */
export interface TaskDependenciesResponse {
  taskId: string
  dependencyIds: string[]
}
