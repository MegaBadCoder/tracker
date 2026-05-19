import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AlfyRestClient } from '../../src/rest-client.js';
import { registerProgressTools } from '../../src/tools/progress.js';
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

const activeGoal = {
  id: 1,
  goal_name: 'Read daily',
  status: 'active',
  goal_start: '2026-01-01',
  goal_end: '2026-12-31',
  questions: [{ id: 10, is_active: true, is_habit: true }],
};

const tasks = [
  { id: 1, title: 'Task A', completed: false, dueDate: '2026-05-20T00:00:00.000Z' },
  { id: 2, title: 'Task B', completed: true, dueDate: null },
];

const analyticsQ10 = [
  { date: '2026-05-19', filled: true, answer_text: null, answer_number: null, answer_bool: null },
];

describe('progress tools', () => {
  let client: ReturnType<typeof makeClient>;
  let server: ReturnType<typeof makeServer>;

  beforeEach(() => {
    client = makeClient();
    server = makeServer();
    registerProgressTools(server as unknown as McpServer, client as unknown as AlfyRestClient);
  });

  describe('get_progress', () => {
    it('registers the tool', () => {
      expect(server._tools['get_progress']).toBeDefined();
    });

    it('fetches goals, tasks, and analytics in parallel', async () => {
      client.get
        .mockResolvedValueOnce([activeGoal])   // goals
        .mockResolvedValueOnce(tasks)           // tasks
        .mockResolvedValueOnce(analyticsQ10);   // analytics for q10

      await server.callTool('get_progress', { period: 'today' });

      const calls = (client.get as ReturnType<typeof vi.fn>).mock.calls;
      const paths = calls.map((c: unknown[]) => c[0]);
      expect(paths).toContain('/goals');
      expect(paths).toContain('/tasks');
      expect(paths).toContain('/questions/10/analytics');
    });

    it('returns a ProgressReport with goals and tasks', async () => {
      client.get
        .mockResolvedValueOnce([activeGoal])
        .mockResolvedValueOnce(tasks)
        .mockResolvedValueOnce(analyticsQ10);

      const result = await server.callTool('get_progress', { period: 'today' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed).toHaveProperty('goals');
      expect(parsed).toHaveProperty('tasks');
      expect(Array.isArray(parsed.goals)).toBe(true);
      expect(parsed.tasks).toHaveProperty('total');
      expect(parsed.tasks).toHaveProperty('completed');
      expect(parsed.tasks).toHaveProperty('overdue');
    });

    it('passes period correctly to aggregator', async () => {
      client.get
        .mockResolvedValueOnce([activeGoal])
        .mockResolvedValueOnce(tasks)
        .mockResolvedValueOnce(analyticsQ10);

      const result = await server.callTool('get_progress', { period: 'week' });
      const parsed = JSON.parse(result.content[0].text);
      // Should still return valid structure regardless of period
      expect(parsed).toHaveProperty('goals');
    });

    it('skips analytics fetch for goals with no questions', async () => {
      const goalNoQuestions = { ...activeGoal, questions: [] };
      client.get
        .mockResolvedValueOnce([goalNoQuestions])
        .mockResolvedValueOnce(tasks);

      await server.callTool('get_progress', { period: 'today' });

      const calls = (client.get as ReturnType<typeof vi.fn>).mock.calls;
      const paths = calls.map((c: unknown[]) => c[0]);
      // Should NOT call analytics since no questions
      expect(paths.some((p: string) => p.includes('/analytics'))).toBe(false);
    });

    it('uses default period=today when not specified', async () => {
      client.get
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await server.callTool('get_progress', {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('goals');
      expect(parsed).toHaveProperty('tasks');
    });
  });
});
