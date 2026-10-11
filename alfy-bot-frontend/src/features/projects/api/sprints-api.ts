import type {
  CompleteSprintPayload,
  CreateSprintPayload,
  Sprint,
  StartSprintPayload,
  UpdateSprintPayload,
} from '../model/types'
import { api } from '@/api/client'

export function fetchSprints(projectId: string) {
  return api.get<Sprint[]>(`/projects/${projectId}/sprints`)
}

export function createSprint(projectId: string, data: CreateSprintPayload) {
  return api.post<Sprint>(`/projects/${projectId}/sprints`, data)
}

export function updateSprint(projectId: string, id: string, data: UpdateSprintPayload) {
  return api.patch<Sprint>(`/projects/${projectId}/sprints/${id}`, data)
}

export function deleteSprint(projectId: string, id: string) {
  return api.delete(`/projects/${projectId}/sprints/${id}`)
}

export function startSprint(projectId: string, id: string, data: StartSprintPayload) {
  return api.post<Sprint>(`/projects/${projectId}/sprints/${id}/start`, data)
}

export function completeSprint(projectId: string, id: string, data: CompleteSprintPayload) {
  return api.post<Sprint>(`/projects/${projectId}/sprints/${id}/complete`, data)
}
