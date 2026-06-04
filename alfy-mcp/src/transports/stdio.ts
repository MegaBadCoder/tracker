import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from '../config.js';

export async function startStdioTransport(server: McpServer, config: Config): Promise<void> {
  if (!config.apiToken) {
    console.error('[alfy-mcp] Warning: ALFY_API_TOKEN is not set. Tool calls will fail unless the client provides Authorization headers.');
  } else {
    console.error('[alfy-mcp] Starting stdio transport');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[alfy-mcp] stdio transport connected');
}
