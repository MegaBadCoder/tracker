import type {
  BoardGroup,
  Project,
  Sprint,
  Task,
} from '../../../shared/entities';

import type { PlanningSnapshot } from '../../../shared/types/sprint-planning.types';
export type {
  PlanningSnapshot,
  SprintRetrospective,
} from '../../../shared/types/sprint-planning.types';

export interface SprintCompletion {
  goalOutcome?: 'achieved' | 'partial' | 'missed';
  retrospective?: string;
  improvement?: string;
  carryoverReason?: string;
  taskDestinations?: { taskId: string; sprintId: string | null }[];
  storyDestinations?: { storyId: string; sprintId: string | null }[];
}

export interface PlanningData {
  project: Project;
  tasks: Task[];
  stories: BoardGroup[];
  sprints: Sprint[];
  otherTasks: Task[];
  otherSprints: Sprint[];
  today: string;
}

export interface PlanningMove {
  taskIds: string[];
  storyIds: string[];
  sprintId: string | null;
}

export interface PlanningOrder {
  taskIds: string[];
  sprintId: string | null;
}

export interface PlanningProposal {
  sprintId: string;
  budgetMinutes: number;
  goal: string;
}

/** Возвращает оценку задачи в минутах: явная длительность приоритетнее Pomodoro; без положительной оценки возвращает null. */
export function estimateMinutes(
  task: Pick<Task, 'durationMinutes' | 'pomodoroConfig'>,
): number | null {
  if (task.durationMinutes != null && task.durationMinutes > 0)
    return task.durationMinutes;
  const config = task.pomodoroConfig;
  if (config && config.pomodoroCount > 0 && config.pomodoroDuration > 0)
    return config.pomodoroCount * config.pomodoroDuration;
  return null;
}

/** Создаёт независимый снимок состава спринта с оценками, названиями и состояниями на указанный момент. */
export function planningSnapshot(
  tasks: Task[],
  stories: BoardGroup[],
  capturedAt: string,
): PlanningSnapshot {
  return {
    capturedAt,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      completed: t.completed,
      estimateMinutes: estimateMinutes(t),
      groupId: t.groupId,
    })),
    stories: stories.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      workflowStatusId: s.workflowStatusId ?? s.status,
    })),
  };
}
