import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AlfyRestClient } from '../rest-client.js';

const projectId = z.string().uuid().describe('UUID проекта');
const id = z.string().uuid().describe('UUID спринта');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Календарная дата YYYY-MM-DD');

function toText(data: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

/** Регистрирует инструменты планирования и жизненного цикла спринтов поверх REST API пользователя. */
export function registerSprintTools(server: McpServer, client: AlfyRestClient): void {
  server.registerTool('list_sprints', {
    description: 'Список спринтов проекта, включая закрытые, с датами, целью и статусом.',
    inputSchema: { projectId },
    annotations: { readOnlyHint: true },
  }, async ({ projectId }) => toText(await client.get(`/projects/${projectId}/sprints`)));

  server.registerTool('create_sprint', {
    description: 'Создать запланированный спринт. Без name сервер назначает имя «Спринт N».',
    inputSchema: {
      projectId,
      name: z.string().min(1).optional().describe('Имя спринта'),
      goal: z.string().optional().describe('Цель спринта'),
    },
  }, async ({ projectId, ...body }) => toText(await client.post(`/projects/${projectId}/sprints`, body)));

  server.registerTool('update_sprint', {
    description: 'Изменить имя, цель или даты незакрытого спринта. null очищает цель или дату.',
    inputSchema: {
      projectId, id,
      name: z.string().min(1).optional().describe('Новое имя'),
      goal: z.string().nullable().optional().describe('Цель или null для очистки'),
      startDate: date.nullable().optional(),
      endDate: date.nullable().optional(),
    },
  }, async ({ projectId, id, ...body }) => toText(await client.patch(`/projects/${projectId}/sprints/${id}`, body)));

  server.registerTool('start_sprint', {
    description: 'Запустить запланированный спринт с явными датами. В проекте допустим только один активный спринт.',
    inputSchema: { projectId, id, startDate: date, endDate: date, goal: z.string().optional().describe('Цель спринта') },
  }, async ({ projectId, id, ...body }) => toText(await client.post(`/projects/${projectId}/sprints/${id}/start`, body)));

  server.registerTool('complete_sprint', {
    description: 'Закрыть активный спринт. Незавершённые задачи и открытые истории уходят в явно выбранный бэклог или запланированный спринт; выполненные задачи сохраняются в закрытом спринте.',
    inputSchema: {
      projectId, id,
      moveTo: z.union([z.literal('backlog'), z.string().uuid()]).describe('backlog или UUID запланированного спринта этого проекта'),
    },
  }, async ({ projectId, id, moveTo }) => toText(await client.post(`/projects/${projectId}/sprints/${id}/complete`, { moveTo })));

  server.registerTool('delete_sprint', {
    description: 'Удалить спринт при confirm=true. Его задачи и истории сохраняются, назначение спринта очищается.',
    inputSchema: { projectId, id, confirm: z.literal(true).describe('Явное подтверждение удаления спринта') },
    annotations: { destructiveHint: true },
  }, async ({ projectId, id }) => {
    await client.del(`/projects/${projectId}/sprints/${id}`);
    return toText({ ok: true });
  });

  server.registerTool('list_project_groups', {
    description: 'Дерево эпиков и историй проекта с UUID, статусами и назначениями спринтов и релизов. Используйте UUID истории в move_story_to_sprint.',
    inputSchema: { projectId },
    annotations: { readOnlyHint: true },
  }, async ({ projectId }) => toText(await client.get(`/projects/${projectId}/groups`)));

  server.registerTool('move_story_to_sprint', {
    description: 'Атомарно перенести историю и все её задачи вне закрытых спринтов в незакрытый спринт этого проекта. sprintId=null переносит в бэклог. Пустые истории поддерживаются; задачи закрытых спринтов сохраняются. Возвращает число перенесённых задач updated.',
    inputSchema: {
      projectId,
      storyId: z.string().uuid().describe('UUID истории, не эпика'),
      sprintId: z.string().uuid().nullable().describe('UUID спринта или null для бэклога; поле обязательно'),
    },
  }, async ({ projectId, storyId, sprintId }) => toText(await client.patch(`/projects/${projectId}/groups/${storyId}/sprint`, { sprintId })));
}
