import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AlfyRestClient } from '../rest-client.js';

const projectId = z.string().uuid().describe('UUID проекта');
const id = z.string().uuid().describe('UUID эпика или истории из list_project_groups');
const title = z.string().trim().min(1).describe('Название эпика или истории');
const parentId = z.string().uuid().describe('UUID родительского эпика этого проекта');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe('Дата эпика YYYY-MM-DD; null очищает дату. Для историй даты не поддерживаются');

function toText(data: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

/** Регистрирует создание, редактирование и удаление эпиков и историй через REST API с правами владельца токена. */
export function registerProjectGroupTools(server: McpServer, client: AlfyRestClient): void {
  server.registerTool('create_project_group', {
    description: 'Создать эпик или историю. Без parentId создаётся эпик; с UUID эпика в parentId — история внутри него. Возвращает созданную группу с UUID. Даты доступны только эпикам.',
    inputSchema: {
      projectId, title,
      parentId: parentId.optional(),
      description: z.string().optional().describe('Описание'),
      color: z.string().optional().describe('Цвет, например #ff0000'),
      startDate: date,
      dueDate: date,
    },
  }, async ({ projectId, ...body }) => toText(await client.post(`/projects/${projectId}/groups`, body)));

  server.registerTool('update_project_group', {
    description: 'Редактировать эпик или историю: название, описание, цвет, статус open/done, даты эпика. parentId переносит историю в другой эпик этого проекта; null для parentId не поддерживается. Пропущенные поля сохраняются; null очищает описание, цвет или дату. Статус группы не меняет статусы её задач. Для переноса в спринт используйте move_story_to_sprint.',
    inputSchema: {
      projectId, id,
      title: title.optional(),
      parentId: parentId.optional(),
      description: z.string().nullable().optional().describe('Описание или null для очистки'),
      color: z.string().nullable().optional().describe('Цвет или null для очистки'),
      status: z.enum(['open', 'done']).optional().describe('open — открыть, done — завершить группу'),
      startDate: date,
      dueDate: date,
    },
  }, async ({ projectId, id, ...body }) => toText(await client.patch(`/projects/${projectId}/groups/${id}`, body)));

  server.registerTool('delete_project_group', {
    description: 'Удалить эпик или историю при confirm=true. При удалении эпика удаляются и дочерние истории. Задачи сохраняются, их привязка к удалённым группам очищается.',
    inputSchema: { projectId, id, confirm: z.literal(true).describe('Подтверждение удаления группы и её дочерних историй') },
    annotations: { destructiveHint: true },
  }, async ({ projectId, id }) => {
    await client.del(`/projects/${projectId}/groups/${id}`);
    return toText({ ok: true });
  });
}
