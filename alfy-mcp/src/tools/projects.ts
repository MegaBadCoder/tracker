import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AlfyRestClient } from '../rest-client.js';
import { RestError } from '../rest-client.js';

function toText(data: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

interface ProjectItem {
  id: string;
  title: string;
  parentId: string | null;
  description: string | null;
  viewMode: 'list' | 'board';
  icon: string | null;
  color: string | null;
  order: number;
}

interface TaskItem {
  id: string;
  projectId?: string | null;
}

function pickProject(p: ProjectItem): ProjectItem {
  return {
    id: p.id,
    title: p.title,
    parentId: p.parentId ?? null,
    description: p.description ?? null,
    viewMode: p.viewMode,
    icon: p.icon ?? null,
    color: p.color ?? null,
    order: p.order,
  };
}

export function registerProjectTools(server: McpServer, client: AlfyRestClient): void {
  server.registerTool(
    'list_projects',
    {
      description: 'List all projects as a flat list (id, title, parentId, description, viewMode, icon, color, order)',
      inputSchema: {},
    },
    async () => {
      const projects = await client.get<ProjectItem[]>('/projects');
      return toText(projects.map(pickProject));
    },
  );

  server.registerTool(
    'create_project',
    {
      description: 'Create a project. Nested via parentId.',
      inputSchema: {
        title: z.string().min(1).describe('Project title'),
        description: z.string().optional().describe('Project description'),
        parentId: z.string().uuid().optional().describe('Parent project UUID'),
        viewMode: z.enum(['list', 'board']).optional().describe('View mode (default: list)'),
        icon: z.string().optional().describe('Icon name'),
        color: z.string().optional().describe('Color hex, e.g. #ff0000'),
      },
    },
    async (args) => {
      const body: Record<string, unknown> = { title: args.title };
      if (args.description !== undefined) body['description'] = args.description;
      if (args.parentId !== undefined) body['parentId'] = args.parentId;
      if (args.viewMode !== undefined) body['viewMode'] = args.viewMode;
      if (args.icon !== undefined) body['icon'] = args.icon;
      if (args.color !== undefined) body['color'] = args.color;
      const created = await client.post<ProjectItem>('/projects', body);
      return toText(pickProject(created));
    },
  );

  server.registerTool(
    'update_project',
    {
      description: 'Update a project. Pass null to clear parentId, description, icon, or color.',
      inputSchema: {
        id: z.string().uuid().describe('Project UUID'),
        title: z.string().min(1).optional().describe('New title'),
        description: z.string().nullable().optional().describe('New description, or null to clear'),
        parentId: z.string().uuid().nullable().optional().describe('New parent UUID, or null to make root'),
        viewMode: z.enum(['list', 'board']).optional().describe('View mode'),
        icon: z.string().nullable().optional().describe('Icon name, or null to clear'),
        color: z.string().nullable().optional().describe('Color hex, or null to clear'),
      },
    },
    async ({ id, ...rest }) => {
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) body[k] = v;
      }
      const updated = await client.patch<ProjectItem>(`/projects/${id}`, body);
      return toText(pickProject(updated));
    },
  );

  server.registerTool(
    'delete_project',
    {
      description:
        'Delete a project. Requires confirm=true. Refuses with 409 if the project has child projects or tasks — reparent/move them first.',
      inputSchema: {
        id: z.string().uuid().describe('Project UUID'),
        confirm: z.literal(true).describe('Must be true to delete'),
      },
    },
    async ({ id }) => {
      const [projects, tasks] = await Promise.all([
        client.get<ProjectItem[]>('/projects'),
        client.get<TaskItem[]>('/tasks'),
      ]);
      const childCount = projects.filter((p) => p.parentId === id).length;
      const taskCount = tasks.filter((t) => t.projectId === id).length;
      if (childCount > 0 || taskCount > 0) {
        throw new RestError(
          409,
          `Project has ${childCount} child project(s) and ${taskCount} task(s). Reparent/move them first.`,
        );
      }
      await client.del(`/projects/${id}`);
      return toText({ ok: true });
    },
  );

  server.registerTool(
    'reorder_projects',
    {
      description: 'Set project order. orderedIds is the full ordered list of project UUIDs.',
      inputSchema: {
        orderedIds: z.array(z.string().uuid()).min(1).describe('Project UUIDs in the desired order'),
      },
    },
    async ({ orderedIds }) => {
      await client.patch('/projects/reorder', { orderedIds });
      return toText({ ok: true });
    },
  );
}
