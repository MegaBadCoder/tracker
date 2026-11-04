import type { BoardGroup, Sprint } from './types'

export interface PlanningTask {
  updatedAt?: string
  id: string
  title: string
  completed: boolean
  groupId: string | null
  sprintId: string | null
  order: number
  estimateMinutes: number | null
  priority?: string
  blocked: boolean
}

export interface PlanningContext {
  today?: string
  sprintId: string | null
  capacityMinutes: number | null
  reserveMinutes: number
  plannedMinutes: number
  remainingMinutes: number | null
  unestimatedCount: number
  otherProjectsMinutes: number
  otherProjectsUnestimatedCount?: number
  historicalCapacityMinutes: number | null
  historySampleCount: number
  tasks: PlanningTask[]
  stories: BoardGroup[]
  carryoverCounts: Record<string, number>
}

export interface PlanningProposal {
  taskIds: string[]
  storyIds: string[]
  totalMinutes: number
  unestimatedIds: string[]
  excluded: { id: string, reason: string }[]
  reasons: { id: string, reason: string }[]
}

export interface PlanningSnapshot {
  capturedAt: string
  tasks: { id: string, title: string, completed: boolean, estimateMinutes: number | null, groupId: string | null }[]
  stories: { id: string, title: string, status: string, workflowStatusId: string | null }[]
}

export interface SprintReport {
  sprint: Sprint
  historyComplete: boolean
  initial: PlanningSnapshot | null
  final: PlanningSnapshot | null
  events: { id: string, sprintId: string, taskId: string | null, kind: string, occurredAt: string, title: string }[]
  summary: { planned: number, added: number, removed: number, completed: number, carried: number }
  retrospective: { goalOutcome: string | null, retrospective: string | null, improvement: string | null, carryoverReason: string | null }
}
