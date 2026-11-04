import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AlfyRestClient } from '../rest-client.js';

const projectId = z.string().uuid().describe('UUID проекта');
const sprintId = z.string().uuid().describe('UUID спринта');
const ids = z.array(z.string().uuid()).refine(values => new Set(values).size === values.length, 'UUID не должны повторяться');
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true };
const command = { readOnlyHint: false, destructiveHint: false };

function toText(data: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

/** Регистрирует чтение workflow, бюджета и истории, предварительное планирование и атомарное применение выбранного состава через REST API. */
export function registerPlanningTools(server: McpServer, client: AlfyRestClient): void {
  server.registerTool('get_story_workflow', {
    description: 'Каталог статусов историй проекта. Используйте возвращённый id в workflowStatusId инструмента update_project_group; статус истории независим от выполнения её задач.',
    inputSchema: { projectId },
    annotations: readOnly,
  }, async ({ projectId }) => toText(await client.get(`/projects/${projectId}/story-workflow`)));

  server.registerTool('update_story_workflow', {
    description: 'Заменить каталог статусов историй проекта. Сохраняйте стабильные id существующих статусов. Сервер отклоняет удаление используемых статусов и некорректные категории; перед изменением прочитайте get_story_workflow.',
    inputSchema: {
      projectId,
      statuses: z.array(z.object({
        id: z.string().trim().min(1),
        name: z.string().trim().min(1),
        category: z.enum(['open', 'ready', 'in_progress', 'review', 'done']),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      })).min(1),
    },
    annotations: { ...command, idempotentHint: true },
  }, async ({ projectId, statuses }) => toText(await client.put(`/projects/${projectId}/story-workflow`, { statuses })));

  server.registerTool('get_sprint_planning_context', {
    description: 'Контекст для составления спринта: задачи и истории, оценки в минутах, неизвестные оценки, бюджет, резерв, блокеры, переносы и обязательства других проектов. Без sprintId — контекст бэклога. Сначала прочитайте этот контекст, затем предложите пользователю объяснимый состав под его цель и время. Не считайте задачи без оценки бесплатными.',
    inputSchema: { projectId, sprintId: sprintId.optional() },
    annotations: readOnly,
  }, async ({ projectId, sprintId }) => toText(await client.get(`/projects/${projectId}/planning`, sprintId ? { sprintId } : {})));

  server.registerTool('propose_sprint_plan', {
    description: 'Получить детерминированный черновик состава под цель и явный бюджет в минутах. Ничего не переносит. Ответ содержит причины выбора и исключения, оценки и неизвестные оценки. Ассистент может уточнить предложение по контексту; покажите пользователю состав перед отдельным apply_sprint_plan.',
    inputSchema: { projectId, sprintId, budgetMinutes: z.number().int().nonnegative().describe('Доступный бюджет в минутах'), goal: z.string().trim().min(1).describe('Результат, ради которого собирается спринт') },
    annotations: readOnly,
  }, async ({ projectId, ...body }) => toText(await client.post(`/projects/${projectId}/planning/proposal`, body)));

  server.registerTool('apply_sprint_plan', {
    description: 'Атомарно перенести явно выбранные задачи и истории с незавершёнными задачами в спринт либо бэклог (sprintId=null). Передавайте рассмотренный пользователем состав; не применяйте автоматически сразу после предложения. Пустые массивы обязательны для отсутствующего вида элементов. Возвращает updated и undoToken для отмены. Статусы историй сохраняются.',
    inputSchema: { projectId, sprintId: sprintId.nullable(), taskIds: ids, storyIds: ids },
    annotations: command,
  }, async ({ projectId, ...body }) => toText(await client.post(`/projects/${projectId}/planning/move`, body)));

  server.registerTool('undo_sprint_plan', {
    description: 'Отменить перенос по undoToken из apply_sprint_plan. При более новых изменениях сервер возвращает конфликт вместо перезаписи. Токен относится к исходному проекту и пользователю.',
    inputSchema: { projectId, undoToken: z.string().min(1) },
    annotations: command,
  }, async ({ projectId, undoToken }) => toText(await client.post(`/projects/${projectId}/planning/undo`, { undoToken })));

  server.registerTool('reorder_sprint_tasks', {
    description: 'Изменить очередность задач выбранного спринта или бэклога (sprintId=null). Передайте UUID в желаемом порядке. Назначения и статусы не меняются.',
    inputSchema: { projectId, sprintId: sprintId.nullable(), taskIds: ids },
    annotations: { ...command, idempotentHint: true },
  }, async ({ projectId, ...body }) => toText(await client.patch(`/projects/${projectId}/planning/order`, body)));

  server.registerTool('get_sprint_report', {
    description: 'Получить сохранённый исходный/итоговый состав спринта, изменения и ретроспективу. historyComplete=false означает неполную историю старого спринта: не выдавайте текущий состав за исходный план.',
    inputSchema: { projectId, sprintId },
    annotations: readOnly,
  }, async ({ projectId, sprintId }) => toText(await client.get(`/projects/${projectId}/sprints/${sprintId}/report`)));
}
