import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BoardGroup, Project, Sprint, Task } from '../../../shared/entities';
import { normalizeStoryGroup, storyWorkflow } from '../domain/story-workflow';
import { planningSnapshot, SprintCompletion } from '../domain/planning';

/** Закрывает активный спринт внутри транзакции, сохраняя итог до переноса и проверяя все назначения до первой записи. */
export async function completeSprintInTransaction(
  manager: EntityManager,
  sprintId: string,
  defaultTarget: string | null,
  completion: SprintCompletion,
): Promise<void> {
  const sprint = await manager.findOneByOrFail(Sprint, { id: sprintId });
  if (sprint.status !== 'active')
    throw new BadRequestException('Only an active sprint can be completed');
  const tasks = await manager.findBy(Task, { sprintId });
  const stories = await manager.findBy(BoardGroup, { sprintId, type: 'story' });
  const taskTargets = new Map(
    (completion.taskDestinations ?? []).map((d) => [d.taskId, d.sprintId]),
  );
  const storyTargets = new Map(
    (completion.storyDestinations ?? []).map((d) => [d.storyId, d.sprintId]),
  );
  if (
    taskTargets.size !== (completion.taskDestinations?.length ?? 0) ||
    storyTargets.size !== (completion.storyDestinations?.length ?? 0)
  )
    throw new BadRequestException('Повторяющиеся назначения');
  for (const id of taskTargets.keys()) {
    if (!tasks.some((t) => t.id === id && !t.completed))
      throw new BadRequestException(
        'Переносить можно только незавершённые задачи этого спринта',
      );
  }
  for (const id of storyTargets.keys()) {
    if (!stories.some((s) => s.id === id && s.status !== 'done'))
      throw new BadRequestException(
        'Переносить можно только открытые истории этого спринта',
      );
  }
  const targets = new Set([
    defaultTarget,
    ...taskTargets.values(),
    ...storyTargets.values(),
  ]);
  for (const id of targets) {
    if (id === null) continue;
    const target = await manager.findOneBy(Sprint, {
      id,
      projectId: sprint.projectId,
      userId: sprint.userId,
    });
    if (!target || target.status !== 'planned')
      throw new BadRequestException(
        'Назначение должно быть запланированным спринтом этого проекта',
      );
  }
  for (const story of stories.filter((s) => s.status !== 'done')) {
    const destination = storyTargets.has(story.id)
      ? storyTargets.get(story.id)!
      : defaultTarget;
    for (const task of tasks.filter(
      (t) => t.groupId === story.id && !t.completed,
    )) {
      if (taskTargets.has(task.id) && taskTargets.get(task.id) !== destination)
        throw new BadRequestException(
          'История и её незавершённые задачи должны переноситься вместе',
        );
      taskTargets.set(task.id, destination);
    }
  }
  const project = await manager.findOneByOrFail(Project, {
    id: sprint.projectId,
  });
  const statuses = storyWorkflow(project);
  const finalSnapshot = planningSnapshot(
    tasks,
    stories.map((s) => normalizeStoryGroup(s, statuses)),
    new Date().toISOString(),
  );
  await manager.update(Sprint, sprintId, {
    status: 'closed',
    completedAt: new Date(),
    finalSnapshot,
    retrospective: {
      goalOutcome: completion.goalOutcome ?? null,
      retrospective: completion.retrospective ?? null,
      improvement: completion.improvement ?? null,
      carryoverReason: completion.carryoverReason ?? null,
    },
  });
  for (const task of tasks.filter((t) => !t.completed)) {
    await manager.update(Task, task.id, {
      sprintId: taskTargets.has(task.id)
        ? taskTargets.get(task.id)!
        : defaultTarget,
    });
  }
  for (const story of stories.filter((s) => s.status !== 'done')) {
    await manager.update(BoardGroup, story.id, {
      sprintId: storyTargets.has(story.id)
        ? storyTargets.get(story.id)!
        : defaultTarget,
    });
  }
}
