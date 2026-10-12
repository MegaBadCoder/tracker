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

  it('публикует инструменты вместе с чтением дерева', async () => {
    const { tools } = await client.listTools();
    expect(tools.map(tool => tool.name)).toEqual(expect.arrayContaining([
      'list_project_groups', 'create_project_group', 'update_project_group', 'delete_project_group',
    ]));
    expect(tools.find(tool => tool.name === 'delete_project_group')?.annotations?.destructiveHint).toBe(true);
  });

  it.each([
    { title: 'Эпик', description: 'Описание', color: '#123456', startDate: '2026-10-11', dueDate: '2026-10-20' },
    { title: 'История', parentId: EPIC },
  ])('создаёт группу с правильным родителем и возвращает UUID: $title', async (body) => {
    const saved = { id: STORY, ...body };
    rest.post.mockResolvedValue(saved);
    const result = await client.callTool({ name: 'create_project_group', arguments: { projectId: PROJECT, ...body } });
    expect(result.isError).not.toBe(true);
    expect(rest.post).toHaveBeenCalledTimes(1);
    expect(rest.post).toHaveBeenCalledWith(`/projects/${PROJECT}/groups`, body);
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(saved) }]);
  });

  it.each([
    { title: 'Новое название' },
    { description: null, color: null, startDate: null, dueDate: null },
    { parentId: EPIC, status: 'done' },
    { status: 'open', description: 'Описание' },
  ])('редактирует только переданные поля и сохраняет null: %j', async (body) => {
    rest.patch.mockResolvedValue({ id: STORY, ...body });
    const result = await client.callTool({ name: 'update_project_group', arguments: { projectId: PROJECT, id: STORY, ...body } });
    expect(result.isError).not.toBe(true);
    expect(rest.patch).toHaveBeenCalledTimes(1);
    expect(rest.patch).toHaveBeenCalledWith(`/projects/${PROJECT}/groups/${STORY}`, body);
  });

  it.each([
    ['create_project_group', { projectId: PROJECT, title: '   ' }],
    ['create_project_group', { projectId: PROJECT, title: 'История', parentId: 'bad' }],
    ['update_project_group', { projectId: PROJECT, id: STORY, parentId: null }],
    ['update_project_group', { projectId: PROJECT, id: STORY, status: 'closed' }],
    ['update_project_group', { projectId: PROJECT, id: STORY, startDate: '11.10.2026' }],
    ['delete_project_group', { projectId: PROJECT, id: STORY }],
    ['delete_project_group', { projectId: PROJECT, id: STORY, confirm: false }],
  ])('отклоняет неверные параметры %s до REST', async (name, args) => {
    const result = await client.callTool({ name: name as string, arguments: args });
    expect(result.isError).toBe(true);
    expect(rest.post).not.toHaveBeenCalled();
    expect(rest.patch).not.toHaveBeenCalled();
    expect(rest.del).not.toHaveBeenCalled();
  });

  it('удаляет подтверждённую группу только из указанного проекта', async () => {
    const result = await client.callTool({ name: 'delete_project_group', arguments: { projectId: PROJECT, id: EPIC, confirm: true } });
    expect(rest.del).toHaveBeenCalledTimes(1);
    expect(rest.del).toHaveBeenCalledWith(`/projects/${PROJECT}/groups/${EPIC}`);
    expect(result.content).toEqual([{ type: 'text', text: '{"ok":true}' }]);
  });

  it.each([400, 403, 404])('передаёт отказ API %s без ложного успеха', async (status) => {
    rest.patch.mockRejectedValue(new RestError(status, 'Group update rejected'));
    const result = await client.callTool({ name: 'update_project_group', arguments: { projectId: PROJECT, id: STORY, title: 'Новое' } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('Group update rejected');
  });
});
