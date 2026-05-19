import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AlfyRestClient } from '../rest-client.js';

function toText(data: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

export function registerQuestionTools(server: McpServer, client: AlfyRestClient): void {
  server.registerTool(
    'list_habits',
    {
      description: 'List active habit questions with their answer history',
      inputSchema: {
        days: z.number().int().min(1).optional().describe('Number of days of history to include (default 7)'),
      },
    },
    async ({ days }) => {
      const habits = await client.get('/questions/habits', { days: days ?? 7 });
      return toText(habits);
    },
  );

  server.registerTool(
    'get_question',
    {
      description: 'Get a single habit question by ID',
      inputSchema: {
        id: z.number().int().positive().describe('Question ID'),
      },
    },
    async ({ id }) => {
      const question = await client.get(`/questions/${id}`);
      return toText(question);
    },
  );

  server.registerTool(
    'get_question_analytics',
    {
      description: 'Get answer history analytics for a habit question',
      inputSchema: {
        id: z.number().int().positive().describe('Question ID'),
      },
    },
    async ({ id }) => {
      const analytics = await client.get(`/questions/${id}/analytics`);
      return toText(analytics);
    },
  );

  server.registerTool(
    'create_habit',
    {
      description: 'Create a new standalone habit question',
      inputSchema: {
        question: z.string().min(1).describe('Question text'),
        type: z.enum(['text', 'rating', 'emoji_rating', 'yes_no', 'number', 'time_spent']).describe('Answer type'),
        can_skip: z.boolean().optional().describe('Whether the habit can be skipped (default false)'),
        target_value: z.string().optional().describe('Target reference value for number type'),
        frequency_type: z.enum(['daily', 'weekly_days', 'interval']).optional().describe('Schedule frequency type'),
        days_of_week: z.array(z.number().int().min(0).max(6)).optional().describe('Days of week (0=Sun..6=Sat) for weekly_days'),
        interval_days: z.number().int().min(1).optional().describe('Interval in days for interval type'),
      },
    },
    async (args) => {
      const body: Record<string, unknown> = { question: args.question, type: args.type };
      if (args.can_skip !== undefined) body['can_skip'] = args.can_skip;
      if (args.target_value !== undefined) body['target_value'] = args.target_value;
      if (args.frequency_type !== undefined) body['frequency_type'] = args.frequency_type;
      if (args.days_of_week !== undefined) body['days_of_week'] = args.days_of_week;
      if (args.interval_days !== undefined) body['interval_days'] = args.interval_days;
      const created = await client.post('/questions/habits', body);
      return toText(created);
    },
  );

  server.registerTool(
    'update_habit',
    {
      description: 'Update a habit question',
      inputSchema: {
        id: z.number().int().positive().describe('Question ID'),
        question: z.string().optional().describe('New question text'),
        type: z.enum(['text', 'rating', 'emoji_rating', 'yes_no', 'number', 'time_spent']).optional().describe('New answer type'),
        can_skip: z.boolean().optional().describe('Whether can be skipped'),
        is_habit: z.boolean().optional().describe('Mark as habit'),
        target_value: z.string().optional().describe('New target value'),
      },
    },
    async ({ id, ...rest }) => {
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) body[k] = v;
      }
      const updated = await client.patch(`/questions/${id}`, body);
      return toText(updated);
    },
  );

  server.registerTool(
    'update_habit_schedule',
    {
      description: 'Update the schedule of a habit question',
      inputSchema: {
        id: z.number().int().positive().describe('Question ID'),
        frequency_type: z.enum(['daily', 'weekly_days', 'interval']).describe('Schedule frequency type'),
        days_of_week: z.array(z.number().int().min(0).max(6)).optional().describe('Days of week (0=Sun..6=Sat), required for weekly_days'),
        interval_days: z.number().int().min(1).optional().describe('Interval in days, required for interval type'),
      },
    },
    async ({ id, frequency_type, days_of_week, interval_days }) => {
      const body: Record<string, unknown> = { frequency_type };
      if (days_of_week !== undefined) body['days_of_week'] = days_of_week;
      if (interval_days !== undefined) body['interval_days'] = interval_days;
      const updated = await client.patch(`/questions/${id}/schedule`, body);
      return toText(updated);
    },
  );

  server.registerTool(
    'delete_habit',
    {
      description: 'Deactivate (soft-delete) a habit question',
      inputSchema: {
        id: z.number().int().positive().describe('Question ID'),
      },
    },
    async ({ id }) => {
      await client.del(`/questions/${id}`);
      return toText({ ok: true });
    },
  );

  server.registerTool(
    'answer_question',
    {
      description: 'Record an answer for a habit question on a specific date',
      inputSchema: {
        id: z.number().int().positive().describe('Question ID'),
        scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Date of the answer (YYYY-MM-DD)'),
        answer: z.string().max(200).describe('Answer text (up to 200 chars)'),
      },
    },
    async ({ id, scheduled_date, answer }) => {
      const result = await client.post(`/questions/${id}/answers`, { scheduled_date, answer });
      return toText(result);
    },
  );
}
