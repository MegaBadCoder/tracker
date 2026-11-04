import { BadRequestException, ConflictException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import {
  BoardGroup,
  PlanningUndo,
  ProjectColumn,
  Sprint,
  Task,
} from '../../../shared/entities';
import { PlanningMove, PlanningOrder } from '../domain/planning';
import { mutableSprint } from './planning-access';
import { planningState } from './planning-state';

async function selectedRows(
  manager: EntityManager,
  projectId: string,
  input: PlanningMove,
) {
  const stories = input.storyIds.length
    ? await manager.findBy(BoardGroup, {
        projectId,
        id: In(input.storyIds),
        type: 'story',
      })
    : [];
  const explicitTasks = input.taskIds.length
    ? await manager.findBy(Task, { projectId, id: In(input.taskIds) })
    : [];
  if (
    stories.length !== input.storyIds.length ||
    explicitTasks.length !== input.taskIds.length
  )
    throw new BadRequestException(
      'Все элементы должны принадлежать этому проекту',
    );
  if (!stories.length && !explicitTasks.length)
    throw new BadRequestException('Выберите задачи или истории');
  const closed = new Set(
    (await manager.findBy(Sprint, { projectId, status: 'closed' })).map(
      (s) => s.id,
    ),
  );
  for (const row of [...stories, ...explicitTasks]) {
    if (row.sprintId && closed.has(row.sprintId))
      throw new BadRequestException('Нельзя изменять состав закрытого спринта');
  }
  const children = input.storyIds.length
    ? await manager.findBy(Task, { projectId, groupId: In(input.storyIds) })
    : [];
  const tasks = [
    ...new Map(
      [
        ...explicitTasks,
        ...children.filter((t) => !t.sprintId || !closed.has(t.sprintId)),
      ].map((t) => [t.id, t]),
    ).values(),
  ];
  if (tasks.some((t) => t.isOverdue))
    throw new BadRequestException('Замороженную задачу нельзя переносить');
  return { stories, tasks };
}

/** Атомарно переносит явный выбор и незакрытые задачи выбранных историй; возвращает одноразовую отмену. */
export async function movePlanning(
  manager: EntityManager,
  userId: number,
  projectId: string,
  input: PlanningMove,
) {
  await mutableSprint(manager, projectId, input.sprintId);
  const { tasks, stories } = await selectedRows(manager, projectId, input);
  const before = await planningState(
    manager,
    tasks.map((t) => t.id),
    stories.map((s) => s.id),
  );
  const firstColumn = input.sprintId
    ? await manager.findOne(ProjectColumn, {
        where: { projectId },
        order: { order: 'ASC' },
      })
    : null;
  if (input.sprintId && tasks.some((t) => !t.columnId) && !firstColumn)
    throw new BadRequestException('Сначала создайте колонку проекта');
  for (const task of tasks) {
    await manager.update(Task, task.id, {
      sprintId: input.sprintId,
      ...(input.sprintId && !task.columnId
        ? { columnId: firstColumn!.id }
        : {}),
    });
  }
  for (const story of stories)
    await manager.update(BoardGroup, story.id, { sprintId: input.sprintId });
  const after = await planningState(
    manager,
    tasks.map((t) => t.id),
    stories.map((s) => s.id),
  );
  const undo = await manager.save(PlanningUndo, {
    userId,
    projectId,
    before,
    after,
    used: false,
  });
  return { updated: tasks.length, undoToken: undo.id };
}

/** Отменяет перенос только при неизменных затронутых строках и составе историй; конфликт не выполняет частичных записей. */
export async function undoPlanning(
  manager: EntityManager,
  userId: number,
  projectId: string,
  token: string,
) {
  const undo = await manager.findOneBy(PlanningUndo, {
    id: token,
    userId,
    projectId,
  });
  if (!undo || undo.used)
    throw new ConflictException('Перенос уже отменён или недоступен');
  const current = await planningState(
    manager,
    undo.after.tasks.map((t) => String(t.id)),
    undo.after.stories.map((s) => String(s.id)),
  );
  if (JSON.stringify(current) !== JSON.stringify(undo.after))
    throw new ConflictException(
      'После переноса элементы изменились; отмена не выполнена',
    );
  for (const row of [
    ...undo.before.tasks,
    ...undo.before.stories,
    ...undo.after.tasks,
    ...undo.after.stories,
  ]) {
    await mutableSprint(manager, projectId, row.sprintId as string | null);
  }
  for (const task of undo.before.tasks) {
    await manager.update(Task, String(task.id), {
      sprintId: task.sprintId as string | null,
      columnId: task.columnId as string | null,
    });
  }
  for (const story of undo.before.stories)
    await manager.update(BoardGroup, String(story.id), {
      sprintId: story.sprintId as string | null,
    });
  await manager.update(PlanningUndo, undo.id, { used: true });
  return { updated: undo.before.tasks.length };
}

/** Сохраняет порядок выбранных задач одного спринта; неперечисленные задачи сохраняют взаимный порядок после них. */
export async function reorderPlanning(
  manager: EntityManager,
  projectId: string,
  input: PlanningOrder,
) {
  await mutableSprint(manager, projectId, input.sprintId);
  if (!input.taskIds.length)
    throw new BadRequestException('Пустой порядок задач');
  const all = (
    await manager.find(Task, {
      where: { projectId },
      order: { order: 'ASC', id: 'ASC' },
    })
  ).filter((t) => t.sprintId === input.sprintId);
  const map = new Map(all.map((t) => [t.id, t]));
  if (input.taskIds.some((id) => !map.has(id)))
    throw new BadRequestException(
      'Все задачи должны принадлежать выбранному спринту',
    );
  if (input.taskIds.some((id) => map.get(id)!.isOverdue))
    throw new BadRequestException('Замороженную задачу нельзя менять');
  const selected = new Set(input.taskIds);
  const ordered = [
    ...input.taskIds,
    ...all.filter((t) => !selected.has(t.id)).map((t) => t.id),
  ];
  for (const [order, id] of ordered.entries())
    await manager.update(Task, id, { order });
  return { updated: ordered.length };
}
