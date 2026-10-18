import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AlfyRestClient } from '../../src/rest-client.js';
import { RestError } from '../../src/rest-client.js';
import { createServer } from '../../src/server.js';

const PROJECT = '00000000-0000-4000-8000-000000000001';
const EPIC = '00000000-0000-4000-8000-000000000002';
const STORY = '00000000-0000-4000-8000-000000000003';

describe('эпики и истории через MCP', () => {
  let client: Client;
  let server: McpServer;
  let rest: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    rest = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() };
    server = createServer(rest as unknown as AlfyRestClient);
    client = new Client({ name: 'group-tests', version: '1.0.0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(a), server.connect(b)]);
  });

  afterEach(async () => {
    await Promise.all([client.close(), server.close()]);
  });

  it('публикует инструменты и предупреждает о каскадном удалении', async () => {
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name)).toEqual(expect.arrayContaining([
      'create_project_group', 'update_project_group', 'delete_project_group',
    ]));
    const deletion = tools.find(t => t.name === 'delete_project_group');
    expect(deletion?.annotations?.destructiveHint).toBe(true);
    expect(deletion?.description).toContain('все его истории');
  });

  it('публикует перестановку как идемпотентную команду', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find(t => t.name === 'reorder_project_groups');
    expect(tool).toBeDefined();
    expect(tool?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: true });
  });

  it.each([[STORY, EPIC], [EPIC]])('передаёт порядок %j одним PATCH без изменения списка', async (...orderedIds) => {
    for (let i = 0; i < 2; i++) {
      const result = await client.callTool({ name: 'reorder_project_groups', arguments: { projectId: PROJECT, orderedIds } });
      expect(result.isError).not.toBe(true);
      expect(result.content).toEqual([{ type: 'text', text: '{"ok":true}' }]);
    }
    expect(rest.patch).toHaveBeenCalledTimes(2);
    expect(rest.patch).toHaveBeenLastCalledWith(`/projects/${PROJECT}/groups/reorder`, { orderedIds });
    expect(rest.get).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { projectId: PROJECT },
    { projectId: 'bad', orderedIds: [EPIC] },
    { projectId: PROJECT, orderedIds: [] },
    { projectId: PROJECT, orderedIds: ['bad'] },
    { projectId: PROJECT, orderedIds: [EPIC, EPIC] },
    { projectId: PROJECT, orderedIds: null },
  ])('отклоняет некорректную перестановку %j до REST', async (args) => {
    const result = await client.callTool({ name: 'reorder_project_groups', arguments: args });
    expect(result.isError).toBe(true);
    expect(rest.patch).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'Only sibling groups can be reordered'],
    [400, 'All groups must belong to this project'],
    [403, 'Project belongs to another user'],
    [404, 'Project not found'],
    [500, 'Storage failure'],
  ] as const)('не сообщает успех при ошибке REST %s: %s', async (status, message) => {
    rest.patch.mockRejectedValue(new RestError(status, message));
    const result = await client.callTool({ name: 'reorder_project_groups', arguments: { projectId: PROJECT, orderedIds: [EPIC] } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain(message);
  });

  it('создаёт эпик без родителя и возвращает UUID для дальнейших действий', async () => {
    const data = { id: EPIC, projectId: PROJECT, type: 'epic', title: 'Релиз', parentId: null };
    rest.post.mockResolvedValue(data);
    const result = await client.callTool({ name: 'create_project_group', arguments: { projectId: PROJECT, title: 'Релиз' } });
    expect(result.isError).not.toBe(true);
    expect(rest.post).toHaveBeenCalledWith(`/projects/${PROJECT}/groups`, { title: 'Релиз' });
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(data) }]);
  });

  it('создаёт историю внутри эпика, затем задачу внутри истории', async () => {
    rest.post.mockResolvedValueOnce({ id: STORY, parentId: EPIC, type: 'story' });
    const result = await client.callTool({ name: 'create_project_group', arguments: {
      projectId: PROJECT, parentId: EPIC, title: 'Подключение', description: 'MCP', color: '#00ff00',
    } });
    expect(result.isError).not.toBe(true);
    expect(rest.post).toHaveBeenNthCalledWith(1, `/projects/${PROJECT}/groups`, {
      parentId: EPIC, title: 'Подключение', description: 'MCP', color: '#00ff00',
    });
    rest.post.mockResolvedValueOnce({ id: EPIC, groupId: STORY });
    await client.callTool({ name: 'create_task', arguments: { projectId: PROJECT, groupId: STORY, title: 'Проверить MCP' } });
    expect(rest.post).toHaveBeenNthCalledWith(2, '/tasks', { projectId: PROJECT, groupId: STORY, title: 'Проверить MCP' });
  });

  it('передаёт даты эпика', async () => {
    rest.post.mockResolvedValue({ id: EPIC });
    await client.callTool({ name: 'create_project_group', arguments: {
      projectId: PROJECT, title: 'Релиз', startDate: '2026-10-18', dueDate: '2026-10-31',
    } });
    expect(rest.post).toHaveBeenCalledWith(`/projects/${PROJECT}/groups`, {
      title: 'Релиз', startDate: '2026-10-18', dueDate: '2026-10-31',
    });
  });

  it.each(['open', 'done'])('меняет статус на %s и переносит историю в эпик', async (status) => {
    rest.patch.mockResolvedValue({ id: STORY, parentId: EPIC, status });
    const result = await client.callTool({ name: 'update_project_group', arguments: {
      projectId: PROJECT, id: STORY, title: 'Новое имя', parentId: EPIC, status,
    } });
    expect(result.isError).not.toBe(true);
    expect(rest.patch).toHaveBeenCalledWith(`/projects/${PROJECT}/groups/${STORY}`, { title: 'Новое имя', parentId: EPIC, status });
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify({ id: STORY, parentId: EPIC, status }) }]);
  });

  it('сохраняет null для очистки полей и не добавляет пропущенные поля', async () => {
    rest.patch.mockResolvedValue({ id: EPIC });
    await client.callTool({ name: 'update_project_group', arguments: {
      projectId: PROJECT, id: EPIC, description: null, color: null, startDate: null, dueDate: null,
    } });
    expect(rest.patch).toHaveBeenCalledWith(`/projects/${PROJECT}/groups/${EPIC}`, {
      description: null, color: null, startDate: null, dueDate: null,
    });
  });

  it.each([EPIC, STORY])('удаляет выбранную группу %s одним запросом', async (id) => {
    const result = await client.callTool({ name: 'delete_project_group', arguments: { projectId: PROJECT, id, confirm: true } });
    expect(rest.del).toHaveBeenCalledTimes(1);
    expect(rest.del).toHaveBeenCalledWith(`/projects/${PROJECT}/groups/${id}`);
    expect(result.content).toEqual([{ type: 'text', text: '{"ok":true}' }]);
  });

  it.each([
    ['create_project_group', { projectId: PROJECT, title: '' }],
    ['create_project_group', { projectId: PROJECT, title: '  ' }],
    ['create_project_group', { projectId: 'bad', title: 'Эпик' }],
    ['create_project_group', { projectId: PROJECT, title: 'Эпик', parentId: 'bad' }],
    ['create_project_group', { projectId: PROJECT, title: 'Эпик', startDate: '2026-02-30' }],
    ['update_project_group', { projectId: PROJECT, id: STORY, status: 'closed' }],
    ['update_project_group', { projectId: PROJECT, id: STORY, title: null }],
    ['update_project_group', { projectId: PROJECT, id: STORY, parentId: null }],
    ['delete_project_group', { projectId: PROJECT, id: STORY }],
    ['delete_project_group', { projectId: PROJECT, id: STORY, confirm: false }],
    ['delete_project_group', { projectId: PROJECT, id: 'bad', confirm: true }],
  ])('отклоняет некорректный %s до REST', async (name, args) => {
    const result = await client.callTool({ name: name as string, arguments: args });
    expect(result.isError).toBe(true);
    expect(rest.post).not.toHaveBeenCalled();
    expect(rest.patch).not.toHaveBeenCalled();
    expect(rest.del).not.toHaveBeenCalled();
  });

  it.each([
    ['create_project_group', 'post', { projectId: PROJECT, title: 'История', parentId: STORY }, 400, 'Parent must be a top-level epic in this project'],
    ['update_project_group', 'patch', { projectId: PROJECT, id: STORY, startDate: '2026-10-18' }, 400, 'Only epics have dates'],
    ['update_project_group', 'patch', { projectId: PROJECT, id: EPIC, parentId: STORY }, 400, 'Cannot reparent a group that has children'],
    ['delete_project_group', 'del', { projectId: PROJECT, id: STORY, confirm: true }, 404, 'Group not found'],
    ['create_project_group', 'post', { projectId: PROJECT, title: 'Эпик' }, 403, 'Project belongs to another user'],
  ] as const)('возвращает ошибку REST для %s: %s', async (name, method, args, status, message) => {
    rest[method].mockRejectedValue(new RestError(status, message));
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain(message);
  });
});
