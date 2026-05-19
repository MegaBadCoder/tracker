import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AlfyRestClient } from '../rest-client.js';
import { aggregateProgress } from '../lib/progress-aggregator.js';
import type { GoalSummary, TaskSummary, AnalyticsEntry } from '../lib/progress-aggregator.js';

function toText(data: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

export function registerProgressTools(server: McpServer, client: AlfyRestClient): void {
  server.registerTool(
    'get_progress',
    {
      description: 'Get an aggregated progress report for today or the past week',
      inputSchema: {
        period: z.enum(['today', 'week']).optional().describe('Reporting period: "today" or "week" (default: today)'),
      },
    },
    async ({ period }) => {
      const activePeriod: 'today' | 'week' = period ?? 'today';

      // Fetch goals and tasks in parallel first
      const [goals, tasks] = await Promise.all([
        client.get<GoalSummary[]>('/goals'),
        client.get<TaskSummary[]>('/tasks'),
      ]);

      // Collect all unique question IDs from all goals
      const questionIds = new Set<number>();
      for (const goal of goals) {
        for (const q of goal.questions) {
          questionIds.add(q.id);
        }
      }

      // Fetch analytics for all questions in parallel
      const analyticsEntries = await Promise.all(
        Array.from(questionIds).map(async (qId) => {
          const analytics = await client.get<AnalyticsEntry[]>(`/questions/${qId}/analytics`);
          return [qId, analytics] as const;
        }),
      );

      const analyticsByQuestion = new Map<number, AnalyticsEntry[]>(analyticsEntries);

      const report = aggregateProgress(activePeriod, goals, tasks, analyticsByQuestion, new Date());

      return toText(report);
    },
  );
}
