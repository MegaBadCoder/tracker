import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from '../config.js';
import { tokenFromHeaderOrEnv } from '../config.js';
import { AlfyRestClient } from '../rest-client.js';

/**
 * Starts an HTTP server implementing the MCP Streamable HTTP transport.
 * Each request creates a stateless transport instance, scoped to the per-request API token.
 *
 * Endpoint: POST /mcp  (MCP JSON-RPC)
 * GET  /mcp  (SSE stream for server-initiated notifications)
 *
 * The token is extracted from the Authorization: Bearer header or ALFY_API_TOKEN env var.
 */
export async function startHttpTransport(server: McpServer, config: Config): Promise<void> {
  const httpServer = http.createServer(async (req, res) => {
    const url = req.url ?? '';

    // Health check
    if (url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (!url.startsWith('/mcp')) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    // Extract and validate token
    let token: string;
    try {
      token = tokenFromHeaderOrEnv(
        req.headers as Record<string, string | string[] | undefined>,
        config.apiToken,
      );
    } catch (err) {
      console.error('[alfy-mcp] Auth error:', (err as Error).message);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
      return;
    }

    // Create per-request REST client (scoped to the token)
    const _restClient = new AlfyRestClient(config.apiBase, token);

    // Stateless transport: each request gets a fresh transport (no session state)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
    });

    res.on('close', () => {
      transport.close().catch((err: unknown) => {
        console.error('[alfy-mcp] Transport close error:', err);
      });
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error('[alfy-mcp] Request error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(config.httpPort, () => {
      console.error(`[alfy-mcp] HTTP transport listening on port ${config.httpPort}`);
      resolve();
    });
  });

  // Keep the server alive — returned promise never resolves in normal operation
  return new Promise<void>((_resolve, reject) => {
    httpServer.once('error', reject);
  });
}
