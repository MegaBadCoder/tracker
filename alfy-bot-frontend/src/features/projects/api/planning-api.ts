import type { PlanningContext, PlanningProposal, SprintReport } from '../model/planning-types'
import type { StoryWorkflowStatus } from '../model/types'
import { api } from '@/api/client'

export function fetchStoryWorkflow(projectId: string) {
  return api.get<{ statuses: StoryWorkflowStatus[] }>(`/projects/${projectId}/story-workflow`)
}

export function saveStoryWorkflow(projectId: string, statuses: StoryWorkflowStatus[]) {
  return api.put<{ statuses: StoryWorkflowStatus[] }>(`/projects/${projectId}/story-workflow`, { statuses })
}

export function fetchPlanning(projectId: string, sprintId: string | null) {
  return api.get<PlanningContext>(`/projects/${projectId}/planning`, { params: sprintId ? { sprintId } : {} })
}

export function proposePlan(projectId: string, payload: { sprintId: string, budgetMinutes: number, goal: string }) {
  return api.post<PlanningProposal>(`/projects/${projectId}/planning/proposal`, payload)
}

export function movePlanningItems(projectId: string, payload: { taskIds: string[], storyIds: string[], sprintId: string | null }) {
  return api.post<{ updated: number, undoToken: string }>(`/projects/${projectId}/planning/move`, payload)
}

export function undoPlanningMove(projectId: string, undoToken: string) {
  return api.post<{ updated: number }>(`/projects/${projectId}/planning/undo`, { undoToken })
}

export function orderPlanningTasks(projectId: string, taskIds: string[], sprintId: string | null) {
  return api.patch<{ updated: number }>(`/projects/${projectId}/planning/order`, { taskIds, sprintId })
}

export function fetchSprintReport(projectId: string, sprintId: string) {
  return api.get<SprintReport>(`/projects/${projectId}/sprints/${sprintId}/report`)
}
