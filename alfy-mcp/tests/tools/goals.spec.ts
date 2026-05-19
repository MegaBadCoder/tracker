import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AlfyRestClient } from '../../src/rest-client.js';
import { registerGoalTools } from '../../src/tools/goals.js';
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

describe('goal tools', () => {
  let client: ReturnType<typeof makeClient>;
  let server: ReturnType<typeof makeServer>;

  beforeEach(() => {
    client = makeClient();
    server = makeServer();
    registerGoalTools(server as unknown as McpServer, client as unknown as AlfyRestClient);
  });

  describe('list_goals', () => {
    it('registers the tool', () => {
      expect(server._tools['list_goals']).toBeDefined();
    });

    it('calls GET /goals without params when no status given', async () => {
      client.get.mockResolvedValueOnce([]);
      await server.callTool('list_goals', {});
      expect(client.get).toHaveBeenCalledWith('/goals', {});
    });

    it('calls GET /goals?status=active when status given', async () => {
      client.get.mockResolvedValueOnce([]);
      await server.callTool('list_goals', { status: 'active' });
      expect(client.get).toHaveBeenCalledWith('/goals', { status: 'active' });
    });

    it('returns JSON text with goals array', async () => {
      const goals = [{ id: 1, goal_name: 'Read daily', status: 'active', goal_start: '2026-01-01', goal_end: '2026-12-31', questions: [] }];
      client.get.mockResolvedValueOnce(goals);
      const result = await server.callTool('list_goals', {});
      expect(result.content[0].type).toBe('text');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(goals);
    });
  });

  describe('get_goal', () => {
    it('registers the tool', () => {
      expect(server._tools['get_goal']).toBeDefined();
    });

    it('calls GET /goals/:id', async () => {
      client.get.mockResolvedValueOnce({ id: 5, goal_name: 'Test' });
      await server.callTool('get_goal', { id: 5 });
      expect(client.get).toHaveBeenCalledWith('/goals/5');
    });

    it('returns JSON text of the goal', async () => {
      const goal = { id: 5, goal_name: 'Test', status: 'active' };
      client.get.mockResolvedValueOnce(goal);
      const result = await server.callTool('get_goal', { id: 5 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(goal);
    });
  });

  describe('create_goal', () => {
    it('registers the tool', () => {
      expect(server._tools['create_goal']).toBeDefined();
    });

    it('calls POST /goals with the DTO body', async () => {
      client.post.mockResolvedValueOnce({ id: 10 });
      await server.callTool('create_goal', { goal_name: 'New goal', goal_start: '2026-01-01', goal_end: '2026-12-31' });
      expect(client.post).toHaveBeenCalledWith('/goals', {
        goal_name: 'New goal',
        goal_start: '2026-01-01',
        goal_end: '2026-12-31',
      });
    });

    it('returns the created goal as JSON', async () => {
      const created = { id: 10, goal_name: 'New goal', status: 'active' };
      client.post.mockResolvedValueOnce(created);
      const result = await server.callTool('create_goal', { goal_name: 'New goal', goal_start: '2026-01-01', goal_end: '2026-12-31' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(created);
    });
  });

  describe('add_questions_to_goal', () => {
    it('registers the tool', () => {
      expect(server._tools['add_questions_to_goal']).toBeDefined();
    });

    it('calls POST /goals/:id/questions with questions array', async () => {
      client.post.mockResolvedValueOnce({ id: 1 });
      const questions = [{ question: 'How many pages?', type: 'number', canSkip: false, scheduleType: 'daily' }];
      await server.callTool('add_questions_to_goal', { goal_id: 1, questions });
      expect(client.post).toHaveBeenCalledWith('/goals/1/questions', { questions });
    });

    it('returns the updated goal as JSON', async () => {
      const goal = { id: 1, questions: [{ id: 5 }] };
      client.post.mockResolvedValueOnce(goal);
      const result = await server.callTool('add_questions_to_goal', { goal_id: 1, questions: [] });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(goal);
    });
  });

  describe('update_goal', () => {
    it('registers the tool', () => {
      expect(server._tools['update_goal']).toBeDefined();
    });

    it('calls PATCH /goals/:id with name and status', async () => {
      client.patch.mockResolvedValueOnce({ id: 3, status: 'completed' });
      await server.callTool('update_goal', { id: 3, goal_name: 'Updated', status: 'completed' });
      expect(client.patch).toHaveBeenCalledWith('/goals/3', { goal_name: 'Updated', status: 'completed' });
    });

    it('omits undefined fields from patch body', async () => {
      client.patch.mockResolvedValueOnce({ id: 3, status: 'archived' });
      await server.callTool('update_goal', { id: 3, status: 'archived' });
      const callArgs = (client.patch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1]).not.toHaveProperty('goal_name');
      expect(callArgs[1]).toHaveProperty('status', 'archived');
    });

    it('returns updated goal as JSON', async () => {
      const updated = { id: 3, status: 'completed' };
      client.patch.mockResolvedValueOnce(updated);
      const result = await server.callTool('update_goal', { id: 3, status: 'completed' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(updated);
    });
  });
});
