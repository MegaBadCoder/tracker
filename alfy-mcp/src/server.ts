import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AlfyRestClient } from './rest-client.js';
import { registerGoalTools } from './tools/goals.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerQuestionTools } from './tools/questions.js';
import { registerProgressTools } from './tools/progress.js';
import { registerProjectTools } from './tools/projects.js';

/**
 * Factory: creates and returns an McpServer instance with all tools registered.
 * The server is transport-agnostic — attach a transport via server.connect(transport).
 */
export function createServer(client: AlfyRestClient): McpServer {
  const server = new McpServer(
    { name: 'alfy-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  registerGoalTools(server, client);
  registerTaskTools(server, client);
  registerQuestionTools(server, client);
  registerProgressTools(server, client);
  registerProjectTools(server, client);

  return server;
}
