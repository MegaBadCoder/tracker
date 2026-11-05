/** Связь сохранённой задачи с её предшественником; оба идентификатора — UUID задач. */
export interface TaskDependencyEdge {
  taskId: string;
  dependencyId: string;
}

/** Проверяет, образует ли замена предшественников задачи цикл в ориентированном графе. */
export function createsDependencyCycle(
  taskId: string,
  dependencyIds: string[],
  edges: TaskDependencyEdge[],
): boolean {
  const predecessors = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.taskId === taskId) continue;
    const ids = predecessors.get(edge.taskId) ?? [];
    ids.push(edge.dependencyId);
    predecessors.set(edge.taskId, ids);
  }
  const pending = [...dependencyIds];
  const visited = new Set<string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (id === taskId) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const predecessor of predecessors.get(id) ?? []) {
      pending.push(predecessor);
    }
  }
  return false;
}
