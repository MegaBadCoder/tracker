const persistedId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Возвращает путь страницы эпика или истории в проекте; временные и некорректные идентификаторы не имеют постоянной ссылки. */
export function groupLinkPath(projectId: string, groupId: string): string | null {
  return persistedId.test(projectId) && persistedId.test(groupId)
    ? `/tasks/project/${projectId}/group/${groupId}`
    : null
}
