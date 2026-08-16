import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AlfyRestClient } from '../../src/rest-client.js';
import { RestError } from '../../src/rest-client.js';
import { registerProjectTools } from '../../src/tools/projects.js';
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

const ID_A = '00000000-0000-4000-8000-000000000001';
const ID_B = '00000000-0000-4000-8000-000000000002';
const ID_C = '00000000-0000-4000-8000-000000000003';
const ID_NEW = '00000000-0000-4000-8000-000000000010';
const TASK_A = '00000000-0000-4000-8000-000000000101';

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: ID_A,
    title: 'Work',
    parentId: null,
    description: 'desc',
    viewMode: 'list',
    icon: 'star',
    color: '#ff0000',
    order: 0,
    userId: 42,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('project tools', () => {
  let client: ReturnType<typeof makeClient>;
  let server: ReturnType<typeof makeServer>;

  beforeEach(() => {
    client = makeClient();
    server = makeServer();
    registerProjectTools(server as unknown as McpServer, client as unknown as AlfyRestClient);
  });

  describe('list_projects', () => {
    it('registers the tool', () => {
      expect(server._tools['list_projects']).toBeDefined();
    });

    it('calls GET /projects', async () => {
      client.get.mockResolvedValueOnce([project()]);
      await server.callTool('list_projects', {});
      expect(client.get).toHaveBeenCalledWith('/projects');
    });

    it('returns only the lean fields', async () => {
      client.get.mockResolvedValueOnce([project()]);
      const result = await server.callTool('list_projects', {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual([{
        id: ID_A,
        title: 'Work',
        parentId: null,
        description: 'desc',
        viewMode: 'list',
        icon: 'star',
        color: '#ff0000',
        order: 0,
      }]);
      expect(parsed[0]).not.toHaveProperty('userId');
      expect(parsed[0]).not.toHaveProperty('createdAt');
    });
  });

  describe('create_project', () => {
    it('calls POST /projects with title', async () => {
      client.post.mockResolvedValueOnce(project({ id: ID_NEW, title: 'New' }));
      await server.callTool('create_project', { title: 'New' });
      expect(client.post).toHaveBeenCalledWith('/projects', expect.objectContaining({ title: 'New' }));
    });

    it('forwards optional fields', async () => {
      client.post.mockResolvedValueOnce(project({ id: ID_NEW, parentId: ID_A }));
      await server.callTool('create_project', {
        title: 'Child',
        parentId: ID_A,
        viewMode: 'board',
        icon: 'folder',
        color: '#00ff00',
        description: 'nested',
      });
      expect(client.post).toHaveBeenCalledWith('/projects', {
        title: 'Child',
        parentId: ID_A,
        viewMode: 'board',
        icon: 'folder',
        color: '#00ff00',
        description: 'nested',
      });
    });

    it('returns lean created project', async () => {
      client.post.mockResolvedValueOnce(project({ id: ID_NEW, title: 'New' }));
      const result = await server.callTool('create_project', { title: 'New' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe(ID_NEW);
      expect(parsed.title).toBe('New');
      expect(parsed).not.toHaveProperty('userId');
    });
  });

  describe('update_project', () => {
    it('calls PATCH /projects/:id and omits id from body', async () => {
      client.patch.mockResolvedValueOnce(project({ title: 'Renamed' }));
      await server.callTool('update_project', { id: ID_A, title: 'Renamed' });
      expect(client.patch).toHaveBeenCalledWith(`/projects/${ID_A}`, { title: 'Renamed' });
    });

    it('forwards null parentId to detach from parent', async () => {
      client.patch.mockResolvedValueOnce(project({ parentId: null }));
      await server.callTool('update_project', { id: ID_B, parentId: null });
      expect(client.patch).toHaveBeenCalledWith(`/projects/${ID_B}`, { parentId: null });
    });
  });

  describe('delete_project', () => {
    it('registers the tool', () => {
      expect(server._tools['delete_project']).toBeDefined();
    });

    it('deletes an empty project when confirm=true', async () => {
      client.get
        .mockResolvedValueOnce([project(), project({ id: ID_B, title: 'Other' })])
        .mockResolvedValueOnce([{ id: TASK_A, projectId: ID_B }]);
      client.del.mockResolvedValueOnce(null);
      const result = await server.callTool('delete_project', { id: ID_A, confirm: true });
      expect(client.del).toHaveBeenCalledWith(`/projects/${ID_A}`);
      expect(JSON.parse(result.content[0].text)).toEqual({ ok: true });
    });

    it('refuses with 409 when the project has children', async () => {
      client.get
        .mockResolvedValueOnce([
          project(),
          project({ id: ID_B, title: 'Child', parentId: ID_A }),
        ])
        .mockResolvedValueOnce([]);
      await expect(server.callTool('delete_project', { id: ID_A, confirm: true }))
        .rejects.toMatchObject({ status: 409 });
      expect(client.del).not.toHaveBeenCalled();
    });

    it('refuses with 409 when the project has tasks', async () => {
      client.get
        .mockResolvedValueOnce([project()])
        .mockResolvedValueOnce([{ id: TASK_A, projectId: ID_A }]);
      await expect(server.callTool('delete_project', { id: ID_A, confirm: true }))
        .rejects.toBeInstanceOf(RestError);
      expect(client.del).not.toHaveBeenCalled();
    });
  });

  describe('reorder_projects', () => {
    it('calls PATCH /projects/reorder with orderedIds', async () => {
      client.patch.mockResolvedValueOnce(null);
      const result = await server.callTool('reorder_projects', { orderedIds: [ID_B, ID_A, ID_C] });
      expect(client.patch).toHaveBeenCalledWith('/projects/reorder', { orderedIds: [ID_B, ID_A, ID_C] });
      expect(JSON.parse(result.content[0].text)).toEqual({ ok: true });
    });
  });
});
