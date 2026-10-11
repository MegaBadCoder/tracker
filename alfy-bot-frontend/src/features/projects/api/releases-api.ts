import type {
  AssignGroupToReleasePayload,
  CreateReleasePayload,
  Release,
  ReleaseActionPayload,
  UpdateReleasePayload,
} from '../model/types'
import { api } from '@/api/client'

export function fetchReleases(projectId: string) {
  return api.get<Release[]>(`/projects/${projectId}/releases`)
}

export function createRelease(projectId: string, data: CreateReleasePayload) {
  return api.post<Release>(`/projects/${projectId}/releases`, data)
}

export function updateRelease(projectId: string, id: string, data: UpdateReleasePayload) {
  return api.patch<Release>(`/projects/${projectId}/releases/${id}`, data)
}

export function deleteRelease(projectId: string, id: string) {
  return api.delete(`/projects/${projectId}/releases/${id}`)
}

export function releaseRelease(projectId: string, id: string, data: ReleaseActionPayload) {
  return api.post<Release>(`/projects/${projectId}/releases/${id}/release`, data)
}

export function assignGroupToRelease(projectId: string, id: string, data: AssignGroupToReleasePayload) {
  return api.post<{ updated: number }>(`/projects/${projectId}/releases/${id}/assign-group`, data)
}
