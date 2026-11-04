import type { BoardGroup, Sprint } from '../../../shared/entities';
import { estimateMinutes, PlanningData } from './planning';
import { normalizeStoryGroup, storyWorkflow } from './story-workflow';

/** Определяет блокировку истории по явной причине или незавершённой зависимости; отсутствующая зависимость считается блокером. */
export function storyBlocked(
  story: BoardGroup,
  stories: BoardGroup[],
): boolean {
  return (
    Boolean(story.blockedReason?.trim()) ||
    (story.dependencyIds ?? []).some(
      (id) => !stories.some((s) => s.id === id && s.status === 'done'),
    )
  );
}

/** Рассчитывает нагрузку выбранного спринта и возвращает доступные для планирования задачи проекта без изменения данных. */
export function planningContext(data: PlanningData, sprintId: string | null) {
  const sprint = data.sprints.find((s) => s.id === sprintId);
  const closed = new Set(
    data.sprints.filter((s) => s.status === 'closed').map((s) => s.id),
  );
  const tasks = data.tasks
    .filter((t) => !t.sprintId || !closed.has(t.sprintId))
    .map((task) => {
      const story = data.stories.find((s) => s.id === task.groupId);
      return {
        id: task.id,
        title: task.title,
        completed: task.completed,
        groupId: task.groupId,
        sprintId: task.sprintId,
        order: task.order,
        estimateMinutes: estimateMinutes(task),
        priority: task.priority,
        blocked: Boolean(
          task.isOverdue || (story && storyBlocked(story, data.stories)),
        ),
        updatedAt: task.updatedAt.toISOString(),
      };
    });
  const selected = tasks.filter((t) => t.sprintId === sprintId);
  const plannedMinutes = selected.reduce(
    (total, t) => total + (t.estimateMinutes ?? 0),
    0,
  );
  const reserveMinutes = sprint?.reserveMinutes ?? 0;
  const capacityMinutes = sprint?.capacityMinutes ?? null;
  const overlap = new Set(
    data.otherSprints
      .filter(
        (s) =>
          s.status !== 'closed' &&
          s.startDate &&
          s.endDate &&
          sprint?.startDate &&
          sprint.endDate &&
          s.startDate <= sprint.endDate &&
          s.endDate >= sprint.startDate,
      )
      .map((s) => s.id),
  );
  const otherTasks = data.otherTasks.filter(
    (t) => !t.completed && t.sprintId && overlap.has(t.sprintId),
  );
  const duration = (s: Sprint | undefined): number | null =>
    s?.startDate && s.endDate
      ? Date.parse(s.endDate) - Date.parse(s.startDate)
      : null;
  const targetDuration = duration(sprint);
  const samples = data.sprints
    .filter(
      (s) =>
        targetDuration !== null &&
        duration(s) === targetDuration &&
        s.status === 'closed' &&
        s.initialSnapshot &&
        s.finalSnapshot &&
        s.finalSnapshot.tasks.every((t) => t.estimateMinutes !== null),
    )
    .map((s) =>
      s
        .finalSnapshot!.tasks.filter((t) => t.completed)
        .reduce((total, t) => total + t.estimateMinutes!, 0),
    )
    .sort((a, b) => a - b);
  const historicalCapacityMinutes = samples.length
    ? (samples[Math.floor((samples.length - 1) / 2)] +
        samples[Math.floor(samples.length / 2)]) /
      2
    : null;
  const carryoverCounts: Record<string, number> = {};
  for (const previous of data.sprints.filter(
    (s) => s.status === 'closed' && s.finalSnapshot,
  )) {
    for (const task of previous.finalSnapshot!.tasks.filter(
      (t) => !t.completed,
    ))
      carryoverCounts[task.id] = (carryoverCounts[task.id] ?? 0) + 1;
    for (const story of previous.finalSnapshot!.stories.filter(
      (s) => s.status !== 'done',
    ))
      carryoverCounts[story.id] = (carryoverCounts[story.id] ?? 0) + 1;
  }
  const statuses = storyWorkflow(data.project);
  return {
    today: data.today,
    sprintId,
    capacityMinutes,
    reserveMinutes,
    plannedMinutes,
    remainingEffortMinutes: selected
      .filter((t) => !t.completed)
      .reduce((total, t) => total + (t.estimateMinutes ?? 0), 0),
    remainingMinutes:
      capacityMinutes === null
        ? null
        : capacityMinutes - reserveMinutes - plannedMinutes,
    unestimatedCount: selected.filter((t) => t.estimateMinutes === null).length,
    otherProjectsMinutes: otherTasks.reduce(
      (total, t) => total + (estimateMinutes(t) ?? 0),
      0,
    ),
    otherProjectsUnestimatedCount: otherTasks.filter(
      (t) => estimateMinutes(t) === null,
    ).length,
    historicalCapacityMinutes,
    historySampleCount: samples.length,
    tasks,
    stories: data.stories.map((s) => normalizeStoryGroup(s, statuses)),
    carryoverCounts,
  };
}
