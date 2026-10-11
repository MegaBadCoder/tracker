import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AlfyRestClient } from '../../src/rest-client.js';
import { RestError } from '../../src/rest-client.js';
import { createServer } from '../../src/server.js';

const PROJECT = '00000000-0000-4000-8000-000000000001';
const SPRINT = '00000000-0000-4000-8000-000000000002';
const STORY = '00000000-0000-4000-8000-000000000003';

describe('sprint tools through MCP', () => {
  let client: Client;
  let server: McpServer;
  let rest: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    rest = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() };
    server = createServer(rest as unknown as AlfyRestClient);
    client = new Client({ name: 'sprint-tests', version: '1.0.0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(a), server.connect(b)]);
  });

  afterEach(async () => {
    await Promise.all([client.close(), server.close()]);
  });

  it('registers planning and lifecycle tools in the server', async () => {
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name)).toEqual(expect.arrayContaining([
      'list_sprints', 'create_sprint', 'update_sprint', 'start_sprint',
      'complete_sprint', 'delete_sprint', 'move_story_to_sprint', 'list_project_groups',
    ]));
  });

  it('lists closed sprints and preserves their fields', async () => {
    const data = [{ id: SPRINT, status: 'closed', completedAt: '2026-10-07T00:00:00Z' }];
    rest.get.mockResolvedValue(data);
    const result = await client.callTool({ name: 'list_sprints', arguments: { projectId: PROJECT } });
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(data) }]);
    expect(rest.get).toHaveBeenCalledWith(`/projects/${PROJECT}/sprints`);
  });

  it('creates a sprint without inventing a name', async () => {
    rest.post.mockResolvedValue({ id: SPRINT });
    const result = await client.callTool({ name: 'create_sprint', arguments: { projectId: PROJECT } });
    expect(result.isError).not.toBe(true);
    expect(rest.post).toHaveBeenCalledWith(`/projects/${PROJECT}/sprints`, {});
  });

  it('updates nullable fields without leaking routing arguments', async () => {
    rest.patch.mockResolvedValue({ id: SPRINT });
    await client.callTool({ name: 'update_sprint', arguments: { projectId: PROJECT, id: SPRINT, goal: null, startDate: null } });
    expect(rest.patch).toHaveBeenCalledWith(`/projects/${PROJECT}/sprints/${SPRINT}`, { goal: null, startDate: null });
  });

  it('starts with explicit dates', async () => {
    rest.post.mockResolvedValue({ id: SPRINT, status: 'active' });
    await client.callTool({ name: 'start_sprint', arguments: { projectId: PROJECT, id: SPRINT, startDate: '2026-10-07', endDate: '2026-10-14' } });
    expect(rest.post).toHaveBeenCalledWith(`/projects/${PROJECT}/sprints/${SPRINT}/start`, { startDate: '2026-10-07', endDate: '2026-10-14' });
  });

  it.each(['backlog', STORY])('completes with explicit target %s', async (moveTo) => {
    rest.post.mockResolvedValue({ id: SPRINT, status: 'closed' });
    await client.callTool({ name: 'complete_sprint', arguments: { projectId: PROJECT, id: SPRINT, moveTo } });
    expect(rest.post).toHaveBeenCalledWith(`/projects/${PROJECT}/sprints/${SPRINT}/complete`, { moveTo });
  });

  it('requires confirmation before deleting a sprint', async () => {
    const result = await client.callTool({ name: 'delete_sprint', arguments: { projectId: PROJECT, id: SPRINT } });
    expect(result.isError).toBe(true);
    expect(rest.del).not.toHaveBeenCalled();
  });

  it('deletes only the requested sprint', async () => {
    const result = await client.callTool({ name: 'delete_sprint', arguments: { projectId: PROJECT, id: SPRINT, confirm: true } });
    expect(rest.del).toHaveBeenCalledWith(`/projects/${PROJECT}/sprints/${SPRINT}`);
    expect(result.content).toEqual([{ type: 'text', text: '{"ok":true}' }]);
  });

  it.each([SPRINT, null])('moves a whole story with sprintId %s in one command', async (sprintId) => {
    rest.patch.mockResolvedValue({ updated: 2 });
    await client.callTool({ name: 'move_story_to_sprint', arguments: { projectId: PROJECT, storyId: STORY, sprintId } });
    expect(rest.patch).toHaveBeenCalledTimes(1);
    expect(rest.patch).toHaveBeenCalledWith(`/projects/${PROJECT}/groups/${STORY}/sprint`, { sprintId });
  });

  it('lists the group tree to discover story IDs', async () => {
    rest.get.mockResolvedValue([{ id: STORY, sprintId: SPRINT }]);
    await client.callTool({ name: 'list_project_groups', arguments: { projectId: PROJECT } });
    expect(rest.get).toHaveBeenCalledWith(`/projects/${PROJECT}/groups`);
  });

  it.each([
    ['start_sprint', { projectId: PROJECT, id: SPRINT }],
    ['complete_sprint', { projectId: PROJECT, id: SPRINT }],
    ['move_story_to_sprint', { projectId: PROJECT, storyId: STORY }],
    ['move_story_to_sprint', { projectId: PROJECT, storyId: STORY, sprintId: 'bad' }],
  ])('rejects malformed %s before REST', async (name, args) => {
    const result = await client.callTool({ name: name as string, arguments: args });
    expect(result.isError).toBe(true);
    expect(rest.post).not.toHaveBeenCalled();
    expect(rest.patch).not.toHaveBeenCalled();
  });

  it('surfaces a closed-sprint error from REST', async () => {
    rest.patch.mockRejectedValue(new RestError(400, 'Closed sprint'));
    const result = await client.callTool({ name: 'move_story_to_sprint', arguments: { projectId: PROJECT, storyId: STORY, sprintId: SPRINT } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('Closed sprint');
  });

  it('exposes task sprint and story assignment without dropping null', async () => {
    rest.post.mockResolvedValue({ id: STORY });
    await client.callTool({ name: 'create_task', arguments: { title: 'Task', projectId: PROJECT, groupId: STORY, sprintId: SPRINT } });
    expect(rest.post).toHaveBeenCalledWith('/tasks', { title: 'Task', projectId: PROJECT, groupId: STORY, sprintId: SPRINT });
    rest.patch.mockResolvedValue({ task: { id: STORY } });
    await client.callTool({ name: 'update_task', arguments: { id: STORY, sprintId: null } });
    expect(rest.patch).toHaveBeenCalledWith(`/tasks/${STORY}`, { sprintId: null });
  });

  it('filters task listing by sprint or backlog', async () => {
    rest.get.mockResolvedValue([{ id: 'a', sprintId: SPRINT }, { id: 'b', sprintId: null }]);
    const inSprint = await client.callTool({ name: 'list_tasks', arguments: { sprint_id: SPRINT } });
    expect(inSprint.content).toEqual([{ type: 'text', text: JSON.stringify([{ id: 'a', sprintId: SPRINT }]) }]);
    const backlog = await client.callTool({ name: 'list_tasks', arguments: { sprint_id: null } });
    expect(backlog.content).toEqual([{ type: 'text', text: JSON.stringify([{ id: 'b', sprintId: null }]) }]);
  });

  it('creates and identifies an Agile project for sprint planning', async () => {
    rest.post.mockResolvedValue({ id: PROJECT, type: 'agile', viewMode: 'board' });
    const result = await client.callTool({ name: 'create_project', arguments: { title: 'Agile', type: 'agile' } });
    expect(rest.post).toHaveBeenCalledWith('/projects', { title: 'Agile', type: 'agile' });
    expect(JSON.stringify(result.content)).toContain('agile');
    rest.get.mockResolvedValue([{ id: PROJECT, type: 'agile', viewMode: 'board' }]);
    const projects = await client.callTool({ name: 'list_projects', arguments: {} });
    expect(JSON.stringify(projects.content)).toContain('agile');
  });
});
