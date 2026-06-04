#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { loadConfig } from './config.js';
import { AlfyRestClient } from './rest-client.js';
import { createServer } from './server.js';
import { startStdioTransport } from './transports/stdio.js';
import { startHttpTransport } from './transports/http.js';

const { values } = parseArgs({
  options: {
    stdio: { type: 'boolean' },
    http: { type: 'boolean' },
  },
  strict: false,
});

const config = loadConfig();

if (values.stdio) {
  if (!config.apiToken) {
    console.error('[alfy-mcp] Warning: ALFY_API_TOKEN not set. Stdio mode requires a token.');
  }
  const client = new AlfyRestClient(config.apiBase, config.apiToken ?? '');
  const server = createServer(client);
  await startStdioTransport(server, config);
} else if (values.http) {
  // In HTTP mode, the client is created per-request inside startHttpTransport
  // Pass a placeholder server — http transport creates the real one per request
  await startHttpTransport(config);
} else {
  console.error('Usage: alfy-mcp --stdio | --http');
  process.exit(2);
}
