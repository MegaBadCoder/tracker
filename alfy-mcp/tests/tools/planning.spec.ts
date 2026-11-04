import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AlfyRestClient, RestError } from '../../src/rest-client.js';
import { createServer } from '../../src/server.js';

const PROJECT = '00000000-0000-4000-8000-000000000001';
const SPRINT = '00000000-0000-4000-8000-000000000002';
const TASK = '00000000-0000-4000-8000-000000000003';
const STORY = '00000000-0000-4000-8000-000000000004';

describe('планирование через MCP', () => {
  let client: Client;
  let server: McpServer;
  let rest: Record<'get' | 'post' | 'patch' | 'put' | 'del', ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    rest = { get: vi.fn().mockResolvedValue({}), post: vi.fn().mockResolvedValue({}), patch: vi.fn().mockResolvedValue({}), put: vi.fn().mockResolvedValue({}), del: vi.fn().mockResolvedValue({}) };
    server = createServer(rest as unknown as AlfyRestClient);
    client = new Client({ name: 'planning-tests', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(a), server.connect(b)]);
  });

  afterEach(async () => {
    await Promise.all([client.close(), server.close()]);
  });

  it('публикует контекст и предложение как операции без изменения задач', async () => {
    const { tools } = await client.listTools();
    for (const name of ['get_sprint_planning_context', 'propose_sprint_plan', 'get_sprint_report', 'get_story_workflow']) {
      expect(tools.find(tool => tool.name === name)?.annotations?.readOnlyHint).toBe(true);
    }
    expect(tools.find(tool => tool.name === 'apply_sprint_plan')?.annotations?.readOnlyHint).toBe(false);
  });

  it('загружает контекст выбранного спринта', async () => {
    rest.get.mockResolvedValue({ unestimatedCount: 2, capacityMinutes: null });
    const result = await client.callTool({ name: 'get_sprint_planning_context', arguments: { projectId: PROJECT, sprintId: SPRINT } });
    expect(result.isError).not.toBe(true);
    expect(rest.get).toHaveBeenCalledWith(`/projects/${PROJECT}/planning`, { sprintId: SPRINT });
    expect(JSON.stringify(result.content)).toContain('unestimatedCount');
  });

  it('запрашивает предложение с явным бюджетом и целью без применения', async () => {
    rest.post.mockResolvedValue({ taskIds: [TASK], reasons: [{ id: TASK, reason: 'Соответствует цели' }] });
    const result = await client.callTool({ name: 'propose_sprint_plan', arguments: { projectId: PROJECT, sprintId: SPRINT, budgetMinutes: 90, goal: 'Оплата' } });
    expect(result.isError).not.toBe(true);
    expect(rest.post).toHaveBeenCalledWith(`/projects/${PROJECT}/planning/proposal`, { sprintId: SPRINT, budgetMinutes: 90, goal: 'Оплата' });
  });

  it('применяет только явно выбранный состав одной командой', async () => {
    rest.post.mockResolvedValue({ updated: 3, undoToken: 'token' });
    await client.callTool({ name: 'apply_sprint_plan', arguments: { projectId: PROJECT, sprintId: SPRINT, taskIds: [TASK], storyIds: [STORY] } });
    expect(rest.post).toHaveBeenCalledWith(`/projects/${PROJECT}/planning/move`, { sprintId: SPRINT, taskIds: [TASK], storyIds: [STORY] });
  });

  it('возвращает выбранное в бэклог и передаёт токен отмены', async () => {
    rest.post.mockResolvedValue({ updated: 1 });
    await client.callTool({ name: 'apply_sprint_plan', arguments: { projectId: PROJECT, sprintId: null, taskIds: [TASK], storyIds: [] } });
    expect(rest.post).toHaveBeenCalledWith(`/projects/${PROJECT}/planning/move`, { sprintId: null, taskIds: [TASK], storyIds: [] });
    await client.callTool({ name: 'undo_sprint_plan', arguments: { projectId: PROJECT, undoToken: 'original-token' } });
    expect(rest.post).toHaveBeenLastCalledWith(`/projects/${PROJECT}/planning/undo`, { undoToken: 'original-token' });
  });

  it('передаёт историю и ретроспективу без пересчёта на стороне MCP', async () => {
    const report = { historyComplete: false, initial: null, final: null, summary: { completed: 2 } };
    rest.get.mockResolvedValue(report);
    const result = await client.callTool({ name: 'get_sprint_report', arguments: { projectId: PROJECT, sprintId: SPRINT } });
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(report) }]);
    expect(rest.get).toHaveBeenCalledWith(`/projects/${PROJECT}/sprints/${SPRINT}/report`);
  });

  it('настраивает workflow через PUT, не меняя идентификаторы', async () => {
    const statuses = [{ id: 'review', name: 'Проверяется', category: 'review', color: '#123456' }];
    rest.put.mockResolvedValue({ statuses });
    const result = await client.callTool({ name: 'update_story_workflow', arguments: { projectId: PROJECT, statuses } });
    expect(result.isError).not.toBe(true);
    expect(rest.put).toHaveBeenCalledWith(`/projects/${PROJECT}/story-workflow`, { statuses });
  });

  it('передаёт workflow, блокер, архив, отложенную дату и зависимости истории', async () => {
    const body = { workflowStatusId: 'review', blockedReason: null, archived: false, deferredUntil: '2026-11-15', dependencyIds: [TASK] };
    rest.patch.mockResolvedValue({ id: STORY });
    await client.callTool({ name: 'update_project_group', arguments: { projectId: PROJECT, id: STORY, ...body } });
    expect(rest.patch).toHaveBeenCalledWith(`/projects/${PROJECT}/groups/${STORY}`, body);
  });

  it('передаёт бюджет и итоги через существующие инструменты', async () => {
    rest.patch.mockResolvedValue({ id: SPRINT });
    await client.callTool({ name: 'update_sprint', arguments: { projectId: PROJECT, id: SPRINT, capacityMinutes: 600, reserveMinutes: 60 } });
    expect(rest.patch).toHaveBeenCalledWith(`/projects/${PROJECT}/sprints/${SPRINT}`, { capacityMinutes: 600, reserveMinutes: 60 });
    const result = { moveTo: 'backlog', goalOutcome: 'partial', retrospective: 'Не хватило оценки', improvement: 'Дробить истории', carryoverReason: 'Зависимость', taskDestinations: [{ taskId: TASK, sprintId: null }], storyDestinations: [{ storyId: STORY, sprintId: null }] };
    await client.callTool({ name: 'complete_sprint', arguments: { projectId: PROJECT, id: SPRINT, ...result } });
    expect(rest.post).toHaveBeenCalledWith(`/projects/${PROJECT}/sprints/${SPRINT}/complete`, result);
  });

  it('сохраняет ручную очередность задач', async () => {
    rest.patch.mockResolvedValue({ updated: 1 });
    await client.callTool({ name: 'reorder_sprint_tasks', arguments: { projectId: PROJECT, sprintId: null, taskIds: [TASK] } });
    expect(rest.patch).toHaveBeenCalledWith(`/projects/${PROJECT}/planning/order`, { sprintId: null, taskIds: [TASK] });
  });

  it.each([
    ['propose_sprint_plan', { projectId: PROJECT, sprintId: SPRINT, goal: 'Оплата' }],
    ['propose_sprint_plan', { projectId: PROJECT, sprintId: SPRINT, goal: 'Оплата', budgetMinutes: -1 }],
    ['apply_sprint_plan', { projectId: PROJECT, sprintId: SPRINT, taskIds: [TASK] }],
    ['apply_sprint_plan', { projectId: PROJECT, sprintId: SPRINT, taskIds: [TASK, TASK], storyIds: [] }],
    ['undo_sprint_plan', { projectId: PROJECT, undoToken: '' }],
    ['update_project_group', { projectId: PROJECT, id: STORY, deferredUntil: '2026-02-31' }],
  ])('отклоняет некорректный %s до REST', async (name, args) => {
    const result = await client.callTool({ name: name as string, arguments: args });
    expect(result.isError).toBe(true);
    expect(rest.post).not.toHaveBeenCalled();
    expect(rest.patch).not.toHaveBeenCalled();
  });

  it('показывает конфликт отмены как ошибку', async () => {
    rest.post.mockRejectedValue(new RestError(409, 'План уже изменён'));
    const result = await client.callTool({ name: 'undo_sprint_plan', arguments: { projectId: PROJECT, undoToken: 'old-token' } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('План уже изменён');
  });
});
