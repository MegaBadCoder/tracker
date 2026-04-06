import { api } from '@/api/client'
import type { ProjectColumn } from '../model/types'

export interface CreateColumnPayload {
  title: string
  color?: string | null
}

export interface UpdateColumnPayload {
  title?: string
  color?: string | null
}

export const fetchColumns = (projectId: string) =>
  api.get<ProjectColumn[]>(`/projects/${projectId}/columns`)

export const createColumn = (projectId: string, data: CreateColumnPayload) =>
  api.post<ProjectColumn>(`/projects/${projectId}/columns`, data)

export const updateColumn = (projectId: string, id: string, data: UpdateColumnPayload) =>
  api.patch<ProjectColumn>(`/projects/${projectId}/columns/${id}`, data)

export const deleteColumn = (projectId: string, id: string) =>
  api.delete(`/projects/${projectId}/columns/${id}`)

export const reorderColumns = (projectId: string, orderedIds: string[]) =>
  api.patch(`/projects/${projectId}/columns/reorder`, { orderedIds })
