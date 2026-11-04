import type { BoardGroup, Task } from '../../../shared/entities';
import { estimateMinutes, PlanningData, PlanningProposal } from './planning';
import { storyStatusId, storyWorkflow } from './story-workflow';

type Reason = { id: string; reason: string };
type Candidate = {
  id: string;
  story: BoardGroup | null;
  tasks: Task[];
  order: number;
  title: string;
};

/** Предлагает состав в пределах явного бюджета, включая незавершённые зависимости; неизвестные оценки остаются вне предложения. Записей не выполняет. */
export function proposePlan(data: PlanningData, input: PlanningProposal) {
  const statuses = storyWorkflow(data.project);
  const existing = data.tasks.filter((t) => t.sprintId === input.sprintId);
  const selectedTasks = new Set(existing.map((t) => t.id));
  const selectedStories = new Set(
    data.stories
      .filter((s) => s.sprintId === input.sprintId && s.status !== 'done')
      .map((s) => s.id),
  );
  const unestimated = new Set(
    existing.filter((t) => estimateMinutes(t) === null).map((t) => t.id),
  );
  let totalMinutes = existing.reduce(
    (sum, t) => sum + (estimateMinutes(t) ?? 0),
    0,
  );
  const reasons: Reason[] = [];
  const excluded: Reason[] = [];
  const closed = new Set(
    data.sprints.filter((s) => s.status === 'closed').map((s) => s.id),
  );
  const storyCandidates: Candidate[] = data.stories
    .filter((s) => s.status !== 'done')
    .map((story) => ({
      id: story.id,
      story,
      tasks: data.tasks.filter(
        (t) =>
          t.groupId === story.id && (!t.sprintId || !closed.has(t.sprintId)),
      ),
      order: story.order,
      title: story.title,
    }));
  const candidates = storyCandidates.filter(
    (c) => c.story!.sprintId !== input.sprintId,
  );
  const included = new Map<string, Candidate>();
  candidates.push(
    ...data.tasks
      .filter(
        (t) =>
          !t.completed &&
          !data.stories.some((s) => s.id === t.groupId) &&
          t.sprintId !== input.sprintId,
      )
      .map((task) => ({
        id: task.id,
        story: null,
        tasks: [task],
        order: task.order,
        title: task.title,
      })),
  );
  const terms = input.goal
    .toLocaleLowerCase('ru')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 2);
  const relevance = (candidate: Candidate) =>
    terms.filter((term) =>
      candidate.title.toLocaleLowerCase('ru').includes(term),
    ).length;
  candidates.sort(
    (a, b) =>
      relevance(b) - relevance(a) ||
      a.order - b.order ||
      a.id.localeCompare(b.id),
  );
  const byStory = new Map(storyCandidates.map((c) => [c.id, c]));
  const eligibility = (candidate: Candidate): string | null => {
    const story = candidate.story;
    if (story?.archived) return 'История в архиве';
    if (story?.deferredUntil && story.deferredUntil > data.today)
      return `Отложена до ${story.deferredUntil}`;
    if (story?.blockedReason?.trim())
      return `Заблокирована: ${story.blockedReason}`;
    if (
      story &&
      statuses.find((s) => s.id === storyStatusId(story, statuses))
        ?.category === 'open'
    )
      return 'История ещё не готова к работе';
    if (story?.sprintId && story.sprintId !== input.sprintId)
      return 'История уже назначена в другой спринт';
    if (candidate.tasks.some((t) => t.isOverdue))
      return 'Есть замороженная задача';
    if (
      candidate.tasks.some((t) => t.sprintId && t.sprintId !== input.sprintId)
    )
      return 'Есть задачи в другом спринте';
    const unknown = candidate.tasks.filter((t) => estimateMinutes(t) === null);
    unknown.forEach((t) => unestimated.add(t.id));
    if (unknown.length || (story && candidate.tasks.length === 0))
      return 'Нужна оценка объёма работы';
    return null;
  };
  const gather = (
    candidate: Candidate,
    gathered: Map<string, Candidate>,
    visiting: Set<string>,
  ): string | null => {
    if (gathered.has(candidate.id)) return null;
    if (visiting.has(candidate.id)) return 'Циклическая зависимость';
    const issue = eligibility(candidate);
    if (issue) return issue;
    visiting.add(candidate.id);
    for (const id of candidate.story?.dependencyIds ?? []) {
      const story = data.stories.find((s) => s.id === id);
      if (story?.status === 'done') continue;
      const dependency = byStory.get(id);
      if (!dependency) return 'Зависимость недоступна для планирования';
      const blocked = gather(dependency, gathered, visiting);
      if (blocked) return `Зависимость: ${blocked}`;
    }
    visiting.delete(candidate.id);
    gathered.set(candidate.id, candidate);
    return null;
  };
  for (const candidate of candidates) {
    if (selectedStories.has(candidate.id) || selectedTasks.has(candidate.id))
      continue;
    const gathered = new Map<string, Candidate>();
    const issue = gather(candidate, gathered, new Set());
    if (issue) {
      excluded.push({ id: candidate.id, reason: issue });
      continue;
    }
    const added = [...gathered.values()]
      .flatMap((c) => c.tasks)
      .filter((t) => !selectedTasks.has(t.id));
    const cost = added.reduce((sum, t) => sum + estimateMinutes(t)!, 0);
    if (unestimated.size && existing.some((t) => estimateMinutes(t) === null)) {
      excluded.push({
        id: candidate.id,
        reason: 'Сначала оцените задачи выбранного спринта',
      });
      continue;
    }
    if (totalMinutes + cost > input.budgetMinutes) {
      excluded.push({
        id: candidate.id,
        reason: 'Не помещается в бюджет с учётом зависимостей',
      });
      continue;
    }
    totalMinutes += cost;
    for (const item of gathered.values()) {
      included.set(item.id, item);
      if (item.story) selectedStories.add(item.id);
      item.tasks.forEach((t) => selectedTasks.add(t.id));
      reasons.push({
        id: item.id,
        reason:
          item.id !== candidate.id
            ? 'Необходима для выбранной истории'
            : relevance(item)
              ? 'Связана с целью и помещается в бюджет'
              : 'Следующая по очереди и помещается в бюджет',
      });
    }
  }
  const existingIds = new Set(existing.map((t) => t.id));
  const movingStories = [...included.values()]
    .filter(
      (c) =>
        c.story &&
        (c.story.sprintId !== input.sprintId ||
          c.tasks.some((t) => t.sprintId !== input.sprintId)),
    )
    .map((c) => c.id);
  return {
    taskIds: [...selectedTasks].filter(
      (id) =>
        !existingIds.has(id) &&
        !data.tasks.some(
          (t) => t.id === id && t.groupId && movingStories.includes(t.groupId),
        ),
    ),
    storyIds: movingStories,
    totalMinutes,
    unestimatedIds: [...unestimated],
    excluded,
    reasons,
  };
}
