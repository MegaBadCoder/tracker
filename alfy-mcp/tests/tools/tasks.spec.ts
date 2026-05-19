import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AlfyRestClient } from '../../src/rest-client.js';
import { registerTaskTools } from '../../src/tools/tasks.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

function makeClient(): Record<keyof AlfyRestClient, ReturnType<typeof vi.fn>> {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  } as unknown as Record<keyof AlfyRestClient, ReturnType<typeof vi.fn>>;
}

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;

function makeServer() {
  const tools: Record<string, { config: unknown; handler: ToolHandler }> = {};
  const server = {
    registerTool: vi.fn((name: string, config: unknown, handler: ToolHandler) => {
      tools[name] = { config, handler };
    }),
    _tools: tools,
    async callTool(name: string, args: Record<string, unknown>) {
      if (!tools[name]) throw new Error(`Tool "${name}" not registered`);
      return tools[name].handler(args);
    },
  };
  return server;
}

const sampleTasks = [
  { id: 1, title: 'Task A', completed: false, dueDate: '2026-05-20T00:00:00.000Z', projectId: 'proj-1' },
  { id: 2, title: 'Task B', completed: true, dueDate: null, projectId: 'proj-1' },
  { id: 3, title: 'Task C', completed: false, dueDate: '2026-05-15T00:00:00.000Z', projectId: 'proj-2' },
];

describe('task tools', () => {
  let client: ReturnType<typeof makeClient>;
  let server: ReturnType<typeof makeServer>;

  beforeEach(() => {
    client = makeClient();
    server = makeServer();
    registerTaskTools(server as unknown as McpServer, client as unknown as AlfyRestClient);
  });

  describe('list_tasks', () => {
    it('registers the tool', () => {
      expect(server._tools['list_tasks']).toBeDefined();
    });

    it('calls GET /tasks', async () => {
      client.get.mockResolvedValueOnce(sampleTasks);
      await server.callTool('list_tasks', {});
      expect(client.get).toHaveBeenCalledWith('/tasks');
    });

    it('returns all tasks when no filter given', async () => {
      client.get.mockResolvedValueOnce(sampleTasks);
      const result = await server.callTool('list_tasks', {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(3);
    });

    it('filters by project_id in JS', async () => {
      client.get.mockResolvedValueOnce(sampleTasks);
      const result = await server.callTool('list_tasks', { project_id: 'proj-1' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(2);
      expect(parsed.every((t: { projectId: string }) => t.projectId === 'proj-1')).toBe(true);
    });

    it('filters completed tasks by status=completed', async () => {
      client.get.mockResolvedValueOnce(sampleTasks);
      const result = await server.callTool('list_tasks', { status: 'completed' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe(2);
    });

    it('filters by due_from (inclusive)', async () => {
      client.get.mockResolvedValueOnce(sampleTasks);
      // Task A has dueDate 2026-05-20, Task C has 2026-05-15; from 2026-05-16 → only A
      const result = await server.callTool('list_tasks', { due_from: '2026-05-16' });
      const parsed = JSON.parse(result.content[0].text);
      // Only tasks with dueDate >= due_from — task with no dueDate is excluded too
      expect(parsed.every((t: { dueDate: string | null }) => t.dueDate !== null)).toBe(true);
      expect(parsed.some((t: { id: number }) => t.id === 1)).toBe(true);
    });
  });

  describe('get_task', () => {
    it('registers the tool', () => {
      expect(server._tools['get_task']).toBeDefined();
    });

    it('finds a task by id from list', async () => {
      client.get.mockResolvedValueOnce(sampleTasks);
      const result = await server.callTool('get_task', { id: 1 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe(1);
      expect(parsed.title).toBe('Task A');
    });

    it('throws RestError(404) when task not found', async () => {
      client.get.mockResolvedValueOnce(sampleTasks);
      await expect(server.callTool('get_task', { id: 999 }))
        .rejects.toMatchObject({ status: 404 });
    });

    it('calls GET /tasks (not /tasks/:id)', async () => {
      client.get.mockResolvedValueOnce(sampleTasks);
      await server.callTool('get_task', { id: 1 });
      expect(client.get).toHaveBeenCalledWith('/tasks');
      expect(client.get).not.toHaveBeenCalledWith('/tasks/1');
    });
  });

  describe('create_task', () => {
    it('registers the tool', () => {
      expect(server._tools['create_task']).toBeDefined();
    });

    it('calls POST /tasks with the body', async () => {
      client.post.mockResolvedValueOnce({ id: 10 });
      await server.callTool('create_task', { title: 'New task' });
      expect(client.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({ title: 'New task' }));
    });

    it('returns created task as JSON', async () => {
      const created = { id: 10, title: 'New task' };
      client.post.mockResolvedValueOnce(created);
      const result = await server.callTool('create_task', { title: 'New task' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(created);
    });
  });

  describe('update_task', () => {
    it('registers the tool', () => {
      expect(server._tools['update_task']).toBeDefined();
    });

    it('calls PATCH /tasks/:id with body', async () => {
      client.patch.mockResolvedValueOnce({ id: 1, title: 'Updated' });
      await server.callTool('update_task', { id: 1, title: 'Updated' });
      expect(client.patch).toHaveBeenCalledWith('/tasks/1', expect.objectContaining({ title: 'Updated' }));
    });

    it('omits id from patch body', async () => {
      client.patch.mockResolvedValueOnce({ id: 1 });
      await server.callTool('update_task', { id: 1, title: 'Updated' });
      const body = (client.patch as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(body).not.toHaveProperty('id');
    });
  });

  describe('complete_task', () => {
    it('registers the tool', () => {
      expect(server._tools['complete_task']).toBeDefined();
    });

    it('calls PATCH /tasks/:id with completed: true', async () => {
      client.patch.mockResolvedValueOnce({ id: 1, completed: true });
      await server.callTool('complete_task', { id: 1 });
      expect(client.patch).toHaveBeenCalledWith('/tasks/1', { completed: true });
    });

    it('returns the updated task as JSON', async () => {
      const updated = { id: 1, completed: true };
      client.patch.mockResolvedValueOnce(updated);
      const result = await server.callTool('complete_task', { id: 1 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.completed).toBe(true);
    });
  });

  describe('delete_task', () => {
    it('registers the tool', () => {
      expect(server._tools['delete_task']).toBeDefined();
    });

    it('calls DELETE /tasks/:id', async () => {
      client.del.mockResolvedValueOnce(null);
      await server.callTool('delete_task', { id: 1 });
      expect(client.del).toHaveBeenCalledWith('/tasks/1');
    });

    it('returns ok: true on success', async () => {
      client.del.mockResolvedValueOnce(null);
      const result = await server.callTool('delete_task', { id: 1 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.ok).toBe(true);
    });

    it('propagates RestError(404) when REST returns 404', async () => {
      const { RestError } = await import('../../src/rest-client.js');
      client.del.mockRejectedValueOnce(new RestError(404, 'Not found'));
      await expect(server.callTool('delete_task', { id: 999 }))
        .rejects.toBeInstanceOf(RestError);
    });
  });
});
