import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AlfyRestClient } from '../rest-client.js';
import { RestError } from '../rest-client.js';

function toText(data: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

interface TaskItem {
  id: number;
  title: string;
  completed: boolean;
  dueDate: string | null;
  projectId?: string | null;
}

export function registerTaskTools(server: McpServer, client: AlfyRestClient): void {
  server.registerTool(
    'list_tasks',
    {
      description: 'List tasks with optional client-side filters',
      inputSchema: {
        project_id: z.string().optional().describe('Filter by project UUID'),
        status: z.enum(['pending', 'completed']).optional().describe('Filter by completion status'),
        due_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Include tasks with dueDate >= this date (YYYY-MM-DD)'),
        due_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Include tasks with dueDate <= this date (YYYY-MM-DD)'),
      },
    },
    async ({ project_id, status, due_from, due_to }) => {
      const tasks = await client.get<TaskItem[]>('/tasks');
      let result: TaskItem[] = tasks;

      if (project_id !== undefined) {
        result = result.filter((t) => t.projectId === project_id);
      }
      if (status === 'completed') {
        result = result.filter((t) => t.completed);
      } else if (status === 'pending') {
        result = result.filter((t) => !t.completed);
      }
      if (due_from !== undefined) {
        result = result.filter((t) => t.dueDate !== null && t.dueDate.slice(0, 10) >= due_from);
      }
      if (due_to !== undefined) {
        result = result.filter((t) => t.dueDate !== null && t.dueDate.slice(0, 10) <= due_to);
      }

      return toText(result);
    },
  );

  server.registerTool(
    'get_task',
    {
      description: 'Get a single task by ID (fetches list and filters by id — fail loud if not found)',
      inputSchema: {
        id: z.number().int().positive().describe('Task ID'),
      },
    },
    async ({ id }) => {
      const tasks = await client.get<TaskItem[]>('/tasks');
      const task = tasks.find((t) => t.id === id);
      if (task === undefined) {
        throw new RestError(404, `Task with id ${id} not found`);
      }
      return toText(task);
    },
  );

  server.registerTool(
    'create_task',
    {
      description: 'Create a new task',
      inputSchema: {
        title: z.string().min(1).describe('Task title'),
        description: z.string().optional().describe('Task description'),
        priority: z.enum(['high', 'medium', 'low']).optional().describe('Task priority'),
        dueDate: z.string().optional().describe('Due date (ISO 8601)'),
        deadline: z.string().optional().describe('Hard deadline (ISO 8601)'),
        durationMinutes: z.number().int().min(1).optional().describe('Estimated duration in minutes'),
        location: z.string().optional().describe('Location'),
        tags: z.array(z.string()).optional().describe('Tags'),
        projectId: z.string().uuid().optional().describe('Project UUID'),
        columnId: z.string().uuid().optional().describe('Board column UUID'),
      },
    },
    async (args) => {
      const body: Record<string, unknown> = {};
      if (args.title !== undefined) body['title'] = args.title;
      if (args.description !== undefined) body['description'] = args.description;
      if (args.priority !== undefined) body['priority'] = args.priority;
      if (args.dueDate !== undefined) body['dueDate'] = args.dueDate;
      if (args.deadline !== undefined) body['deadline'] = args.deadline;
      if (args.durationMinutes !== undefined) body['durationMinutes'] = args.durationMinutes;
      if (args.location !== undefined) body['location'] = args.location;
      if (args.tags !== undefined) body['tags'] = args.tags;
      if (args.projectId !== undefined) body['projectId'] = args.projectId;
      if (args.columnId !== undefined) body['columnId'] = args.columnId;
      const created = await client.post('/tasks', body);
      return toText(created);
    },
  );

  server.registerTool(
    'update_task',
    {
      description: 'Update task fields',
      inputSchema: {
        id: z.number().int().positive().describe('Task ID'),
        title: z.string().optional().describe('New title'),
        description: z.string().optional().describe('New description'),
        priority: z.enum(['high', 'medium', 'low']).optional().describe('New priority'),
        dueDate: z.string().optional().describe('New due date (ISO 8601)'),
        deadline: z.string().optional().describe('New deadline (ISO 8601)'),
        durationMinutes: z.number().int().min(1).optional().describe('New duration in minutes'),
        location: z.string().optional().describe('New location'),
        tags: z.array(z.string()).optional().describe('New tags'),
        projectId: z.string().uuid().optional().describe('Move to project UUID'),
        columnId: z.string().uuid().optional().describe('Move to board column UUID'),
      },
    },
    async ({ id, ...rest }) => {
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) body[k] = v;
      }
      const updated = await client.patch(`/tasks/${id}`, body);
      return toText(updated);
    },
  );

  server.registerTool(
    'complete_task',
    {
      description: 'Mark a task as completed',
      inputSchema: {
        id: z.number().int().positive().describe('Task ID'),
      },
    },
    async ({ id }) => {
      const updated = await client.patch(`/tasks/${id}`, { completed: true });
      return toText(updated);
    },
  );

  server.registerTool(
    'delete_task',
    {
      description: 'Delete a task. Throws 404 if task does not exist.',
      inputSchema: {
        id: z.number().int().positive().describe('Task ID'),
      },
    },
    async ({ id }) => {
      await client.del(`/tasks/${id}`);
      return toText({ ok: true });
    },
  );
}
