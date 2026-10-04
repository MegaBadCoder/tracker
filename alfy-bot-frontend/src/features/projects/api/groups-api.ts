import type { BoardGroup, BoardGroupNode, CreateGroupPayload, UpdateGroupPayload } from '../model/types'
import { api } from '@/api/client'

export function fetchGroups(projectId: string) {
  return api.get<BoardGroupNode[]>(`/projects/${projectId}/groups`)
}

export function createGroup(projectId: string, data: CreateGroupPayload) {
  return api.post<BoardGroup>(`/projects/${projectId}/groups`, data)
}

export function updateGroup(projectId: string, id: string, data: UpdateGroupPayload) {
  return api.patch<BoardGroup>(`/projects/${projectId}/groups/${id}`, data)
}

export function deleteGroup(projectId: string, id: string) {
  return api.delete(`/projects/${projectId}/groups/${id}`)
}

export function reorderGroups(projectId: string, orderedIds: string[]) {
  return api.patch(`/projects/${projectId}/groups/reorder`, { orderedIds })
}

/** Назначает или снимает релиз истории и её задач; возвращает число изменённых задач. */
export function setGroupRelease(projectId: string, groupId: string, releaseId: string | null) {
  return api.patch<{ updated: number }>(`/projects/${projectId}/groups/${groupId}/release`, { releaseId })
}
