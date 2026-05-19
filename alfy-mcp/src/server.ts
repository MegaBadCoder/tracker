import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Factory: creates and returns an McpServer instance.
 * Phase 5 will register tools on this server.
 * The server is transport-agnostic — attach a transport via server.connect(transport).
 */
export function createServer(): McpServer {
  return new McpServer(
    { name: 'alfy-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );
}
