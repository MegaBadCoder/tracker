import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AlfyRestClient } from '../rest-client.js';

const projectId = z.string().uuid().describe('UUID проекта');
const id = z.string().uuid().describe('UUID эпика или истории из list_project_groups');
const title = z.string().trim().min(1).describe('Название эпика или истории');
const parentId = z.string().uuid().describe('UUID родительского эпика в том же проекте');
const date = z.string().date().nullable().optional().describe('Дата эпика YYYY-MM-DD или null для очистки; истории не поддерживают даты');

function toText(data: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

/** Регистрирует создание, изменение, перестановку и удаление эпиков и историй через REST API текущего пользователя. */
export function registerGroupTools(server: McpServer, client: AlfyRestClient): void {
  server.registerTool('create_project_group', {
    description: 'Создать эпик или историю в проекте. Без parentId создаётся эпик; с parentId создаётся история внутри указанного эпика. Вложенные истории запрещены. Для задач внутри созданной группы используйте create_task с groupId из ответа. Для назначения истории в спринт используйте move_story_to_sprint.',
    inputSchema: {
      projectId, title,
      parentId: parentId.optional(),
      description: z.string().optional().describe('Описание'),
      color: z.string().optional().describe('Цвет'),
      startDate: date,
      dueDate: date,
    },
  }, async ({ projectId, ...body }) => toText(await client.post(`/projects/${projectId}/groups`, body)));

  server.registerTool('update_project_group', {
    description: 'Редактировать эпик или историю: название, описание, цвет, статус open/done и даты эпика. null очищает описание, цвет или дату. parentId переносит историю в другой эпик того же проекта; группу с дочерними историями переносить нельзя. Пропущенные поля сохраняются. Для спринта используйте move_story_to_sprint.',
    inputSchema: {
      projectId, id,
      title: title.optional(),
      parentId: parentId.optional(),
      description: z.string().nullable().optional().describe('Описание или null для очистки'),
      color: z.string().nullable().optional().describe('Цвет или null для очистки'),
      status: z.enum(['open', 'done']).optional().describe('Открыть или завершить эпик/историю'),
      startDate: date,
      dueDate: date,
    },
  }, async ({ projectId, id, ...body }) => toText(await client.patch(`/projects/${projectId}/groups/${id}`, body)));

  server.registerTool('reorder_project_groups', {
    description: 'Изменить порядок эпиков проекта или историй внутри одного эпика. orderedIds — UUID соседей сверху вниз, без повторов; получите их через list_project_groups. Полный список задаёт точный порядок. Частичный список помещает указанные группы первыми, остальных соседей оставляет следом в прежнем порядке. Нельзя смешивать эпики с историями, истории разных эпиков или группы разных проектов. Родители, задачи, спринты и релизы не меняются. Сохранение атомарно; возвращает {ok:true}.',
    inputSchema: {
      projectId,
      orderedIds: z.array(z.string().uuid()).min(1)
        .refine(ids => new Set(ids).size === ids.length, 'UUID групп не должны повторяться')
        .describe('Непустой список UUID эпиков либо историй одного эпика в нужном порядке сверху вниз'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async ({ projectId, orderedIds }) => {
    await client.patch(`/projects/${projectId}/groups/reorder`, { orderedIds });
    return toText({ ok: true });
  });

  server.registerTool('delete_project_group', {
    description: 'Удалить эпик или историю при confirm=true. При удалении эпика удаляются также все его истории. Задачи сохраняются в проекте, их привязка к удалённым группам очищается; назначения спринтов и релизов задач сохраняются.',
    inputSchema: { projectId, id, confirm: z.literal(true).describe('Подтверждение удаления группы, включая дочерние истории эпика') },
    annotations: { destructiveHint: true },
  }, async ({ projectId, id }) => {
    await client.del(`/projects/${projectId}/groups/${id}`);
    return toText({ ok: true });
  });
}
