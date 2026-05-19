import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AlfyRestClient } from '../rest-client.js';

function toText(data: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

export function registerGoalTools(server: McpServer, client: AlfyRestClient): void {
  server.registerTool(
    'list_goals',
    {
      description: 'List goals, optionally filtered by status',
      inputSchema: {
        status: z.enum(['active', 'completed', 'archived']).optional().describe('Filter by goal status'),
      },
    },
    async ({ status }) => {
      const params: Record<string, unknown> = {};
      if (status !== undefined) params['status'] = status;
      const goals = await client.get('/goals', params);
      return toText(goals);
    },
  );

  server.registerTool(
    'get_goal',
    {
      description: 'Get a single goal by ID',
      inputSchema: {
        id: z.number().int().positive().describe('Goal ID'),
      },
    },
    async ({ id }) => {
      const goal = await client.get(`/goals/${id}`);
      return toText(goal);
    },
  );

  server.registerTool(
    'create_goal',
    {
      description: 'Create a new goal',
      inputSchema: {
        goal_name: z.string().min(1).max(200).describe('Name of the goal'),
        goal_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Start date (YYYY-MM-DD)'),
        goal_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('End date (YYYY-MM-DD)'),
      },
    },
    async ({ goal_name, goal_start, goal_end }) => {
      const created = await client.post('/goals', { goal_name, goal_start, goal_end });
      return toText(created);
    },
  );

  server.registerTool(
    'add_questions_to_goal',
    {
      description: 'Add habit questions to a goal',
      inputSchema: {
        goal_id: z.number().int().positive().describe('Goal ID'),
        questions: z.array(z.object({
          question: z.string().describe('Question text'),
          type: z.enum(['text', 'rating', 'emoji_rating', 'yes_no', 'number', 'time_spent']).describe('Answer type'),
          canSkip: z.boolean().describe('Whether the question can be skipped'),
          scheduleType: z.enum(['daily', 'weekly_days', 'interval']).describe('Schedule frequency type'),
          selectedDays: z.array(z.number().int().min(0).max(6)).optional().describe('Days of week (0=Sun..6=Sat) for weekly_days'),
          intervalDays: z.number().int().min(1).optional().describe('Interval in days for interval type'),
          targetValue: z.string().optional().describe('Target reference value for number type'),
        })).min(1).describe('Questions to add'),
      },
    },
    async ({ goal_id, questions }) => {
      const result = await client.post(`/goals/${goal_id}/questions`, { questions });
      return toText(result);
    },
  );

  server.registerTool(
    'update_goal',
    {
      description: 'Update a goal name or status',
      inputSchema: {
        id: z.number().int().positive().describe('Goal ID'),
        goal_name: z.string().min(1).max(200).optional().describe('New goal name'),
        status: z.enum(['active', 'completed', 'archived', 'deleted']).optional().describe('New status'),
      },
    },
    async ({ id, goal_name, status }) => {
      const body: Record<string, unknown> = {};
      if (goal_name !== undefined) body['goal_name'] = goal_name;
      if (status !== undefined) body['status'] = status;
      const updated = await client.patch(`/goals/${id}`, body);
      return toText(updated);
    },
  );
}
