export interface Config {
  apiBase: string;
  apiToken: string | null;
  httpPort: number;
}

export function loadConfig(): Config {
  const apiBase = process.env['ALFY_API_BASE'] ?? 'http://localhost:3002/api';
  const apiToken = process.env['ALFY_API_TOKEN'] ?? null;
  const httpPort = Number.parseInt(process.env['MCP_HTTP_PORT'] ?? '3003', 10);
  return { apiBase, apiToken, httpPort };
}

export function tokenFromHeaderOrEnv(
  headers: Record<string, string | string[] | undefined>,
  envToken: string | null,
): string {
  const auth = headers['authorization'] ?? headers['Authorization'];
  const header = Array.isArray(auth) ? auth[0] : auth;
  if (header && /^Bearer /i.test(header)) return header.slice(7);
  if (envToken) return envToken;
  throw new Error('Missing API token: set ALFY_API_TOKEN or pass Authorization: Bearer header');
}
