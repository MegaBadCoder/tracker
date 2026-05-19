#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { loadConfig } from './config.js';
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
const server = createServer();

if (values.stdio) {
  await startStdioTransport(server, config);
} else if (values.http) {
  await startHttpTransport(server, config);
} else {
  console.error('Usage: alfy-mcp --stdio | --http');
  process.exit(2);
}
