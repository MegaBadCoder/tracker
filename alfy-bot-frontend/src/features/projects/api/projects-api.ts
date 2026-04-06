import { api } from '@/api/client'
import type { Project, CreateProjectPayload, UpdateProjectPayload } from '../model/types'

export const fetchProjects = () =>
  api.get<Project[]>('/projects')

export const fetchProject = (id: string) =>
  api.get<Project>(`/projects/${id}`)

export const createProject = (data: CreateProjectPayload) =>
  api.post<Project>('/projects', data)

export const updateProject = (id: string, data: UpdateProjectPayload) =>
  api.patch<Project>(`/projects/${id}`, data)

export const deleteProject = (id: string) =>
  api.delete(`/projects/${id}`)

export const reorderProjects = (orderedIds: string[]) =>
  api.patch('/projects/reorder', { orderedIds })
