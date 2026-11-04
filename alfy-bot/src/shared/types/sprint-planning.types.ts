export interface PlanningSnapshot {
  capturedAt: string;
  tasks: {
    id: string;
    title: string;
    completed: boolean;
    estimateMinutes: number | null;
    groupId: string | null;
  }[];
  stories: {
    id: string;
    title: string;
    status: string;
    workflowStatusId: string | null;
  }[];
}

export interface SprintRetrospective {
  goalOutcome: 'achieved' | 'partial' | 'missed' | null;
  retrospective: string | null;
  improvement: string | null;
  carryoverReason: string | null;
}
