const persistedTaskId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Возвращает локальный путь сохранённой задачи или null для временного и виртуального идентификатора. */
export function taskLinkPath(taskId: string): string | null {
  return persistedTaskId.test(taskId) ? `/tasks/${taskId}` : null
}
