import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AlfyRestClient } from '../../src/rest-client.js';
import { registerQuestionTools } from '../../src/tools/questions.js';
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

describe('question tools', () => {
  let client: ReturnType<typeof makeClient>;
  let server: ReturnType<typeof makeServer>;

  beforeEach(() => {
    client = makeClient();
    server = makeServer();
    registerQuestionTools(server as unknown as McpServer, client as unknown as AlfyRestClient);
  });

  describe('list_habits', () => {
    it('registers the tool', () => {
      expect(server._tools['list_habits']).toBeDefined();
    });

    it('calls GET /questions/habits with default days=7', async () => {
      client.get.mockResolvedValueOnce([]);
      await server.callTool('list_habits', {});
      expect(client.get).toHaveBeenCalledWith('/questions/habits', { days: 7 });
    });

    it('calls GET /questions/habits with given days', async () => {
      client.get.mockResolvedValueOnce([]);
      await server.callTool('list_habits', { days: 30 });
      expect(client.get).toHaveBeenCalledWith('/questions/habits', { days: 30 });
    });

    it('returns habits as JSON array', async () => {
      const habits = [{ id: 1, question: 'Did you exercise?', type: 'yes_no' }];
      client.get.mockResolvedValueOnce(habits);
      const result = await server.callTool('list_habits', {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(habits);
    });
  });

  describe('get_question', () => {
    it('registers the tool', () => {
      expect(server._tools['get_question']).toBeDefined();
    });

    it('calls GET /questions/:id', async () => {
      client.get.mockResolvedValueOnce({ id: 3 });
      await server.callTool('get_question', { id: 3 });
      expect(client.get).toHaveBeenCalledWith('/questions/3');
    });

    it('returns question as JSON', async () => {
      const q = { id: 3, question: 'Pages read?', type: 'number' };
      client.get.mockResolvedValueOnce(q);
      const result = await server.callTool('get_question', { id: 3 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(q);
    });
  });

  describe('get_question_analytics', () => {
    it('registers the tool', () => {
      expect(server._tools['get_question_analytics']).toBeDefined();
    });

    it('calls GET /questions/:id/analytics', async () => {
      client.get.mockResolvedValueOnce([]);
      await server.callTool('get_question_analytics', { id: 5 });
      expect(client.get).toHaveBeenCalledWith('/questions/5/analytics');
    });

    it('returns analytics array as JSON', async () => {
      const analytics = [
        { date: '2026-05-01', answer_text: null, answer_number: 15, answer_bool: null, filled: true },
        { date: '2026-05-02', answer_text: null, answer_number: 0, answer_bool: null, filled: false },
      ];
      client.get.mockResolvedValueOnce(analytics);
      const result = await server.callTool('get_question_analytics', { id: 5 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(analytics);
    });
  });

  describe('create_habit', () => {
    it('registers the tool', () => {
      expect(server._tools['create_habit']).toBeDefined();
    });

    it('calls POST /questions/habits with required fields', async () => {
      client.post.mockResolvedValueOnce({ id: 7 });
      await server.callTool('create_habit', { question: 'Water intake?', type: 'number' });
      expect(client.post).toHaveBeenCalledWith('/questions/habits', expect.objectContaining({
        question: 'Water intake?',
        type: 'number',
      }));
    });

    it('returns created habit as JSON', async () => {
      const created = { id: 7, question: 'Water intake?', type: 'number' };
      client.post.mockResolvedValueOnce(created);
      const result = await server.callTool('create_habit', { question: 'Water intake?', type: 'number' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(created);
    });
  });

  describe('update_habit', () => {
    it('registers the tool', () => {
      expect(server._tools['update_habit']).toBeDefined();
    });

    it('calls PATCH /questions/:id', async () => {
      client.patch.mockResolvedValueOnce({ id: 7, question: 'Updated?' });
      await server.callTool('update_habit', { id: 7, question: 'Updated?' });
      expect(client.patch).toHaveBeenCalledWith('/questions/7', expect.objectContaining({ question: 'Updated?' }));
    });

    it('omits id from patch body', async () => {
      client.patch.mockResolvedValueOnce({ id: 7 });
      await server.callTool('update_habit', { id: 7, question: 'Updated?' });
      const body = (client.patch as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(body).not.toHaveProperty('id');
    });
  });

  describe('update_habit_schedule', () => {
    it('registers the tool', () => {
      expect(server._tools['update_habit_schedule']).toBeDefined();
    });

    it('calls PATCH /questions/:id/schedule with daily', async () => {
      client.patch.mockResolvedValueOnce({ frequency_type: 'daily' });
      await server.callTool('update_habit_schedule', { id: 3, frequency_type: 'daily' });
      expect(client.patch).toHaveBeenCalledWith('/questions/3/schedule', { frequency_type: 'daily' });
    });

    it('calls PATCH /questions/:id/schedule with days_of_week', async () => {
      client.patch.mockResolvedValueOnce({ frequency_type: 'weekly_days' });
      await server.callTool('update_habit_schedule', { id: 3, frequency_type: 'weekly_days', days_of_week: [1, 3, 5] });
      expect(client.patch).toHaveBeenCalledWith('/questions/3/schedule', {
        frequency_type: 'weekly_days',
        days_of_week: [1, 3, 5],
      });
    });

    it('calls PATCH /questions/:id/schedule with interval_days', async () => {
      client.patch.mockResolvedValueOnce({ frequency_type: 'interval' });
      await server.callTool('update_habit_schedule', { id: 3, frequency_type: 'interval', interval_days: 3 });
      expect(client.patch).toHaveBeenCalledWith('/questions/3/schedule', {
        frequency_type: 'interval',
        interval_days: 3,
      });
    });
  });

  describe('delete_habit', () => {
    it('registers the tool', () => {
      expect(server._tools['delete_habit']).toBeDefined();
    });

    it('calls DELETE /questions/:id', async () => {
      client.del.mockResolvedValueOnce(undefined);
      await server.callTool('delete_habit', { id: 5 });
      expect(client.del).toHaveBeenCalledWith('/questions/5');
    });

    it('returns ok: true', async () => {
      client.del.mockResolvedValueOnce(undefined);
      const result = await server.callTool('delete_habit', { id: 5 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.ok).toBe(true);
    });
  });

  describe('answer_question', () => {
    it('registers the tool', () => {
      expect(server._tools['answer_question']).toBeDefined();
    });

    it('calls POST /questions/:id/answers with scheduled_date and answer', async () => {
      client.post.mockResolvedValueOnce({ ok: true });
      await server.callTool('answer_question', { id: 3, scheduled_date: '2026-05-19', answer: 'да' });
      expect(client.post).toHaveBeenCalledWith('/questions/3/answers', {
        scheduled_date: '2026-05-19',
        answer: 'да',
      });
    });

    it('returns the response as JSON', async () => {
      client.post.mockResolvedValueOnce({ ok: true });
      const result = await server.callTool('answer_question', { id: 3, scheduled_date: '2026-05-19', answer: 'да' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.ok).toBe(true);
    });
  });
});
