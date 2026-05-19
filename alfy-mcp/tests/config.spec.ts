import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, tokenFromHeaderOrEnv } from '../src/config.js';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns defaults when no env vars set', () => {
    delete process.env['ALFY_API_BASE'];
    delete process.env['ALFY_API_TOKEN'];
    delete process.env['MCP_HTTP_PORT'];

    const cfg = loadConfig();

    expect(cfg.apiBase).toBe('http://localhost:3002/api');
    expect(cfg.apiToken).toBeNull();
    expect(cfg.httpPort).toBe(3003);
  });

  it('reads values from env vars', () => {
    process.env['ALFY_API_BASE'] = 'http://backend:3002/api';
    process.env['ALFY_API_TOKEN'] = 'test-token-123';
    process.env['MCP_HTTP_PORT'] = '4000';

    const cfg = loadConfig();

    expect(cfg.apiBase).toBe('http://backend:3002/api');
    expect(cfg.apiToken).toBe('test-token-123');
    expect(cfg.httpPort).toBe(4000);
  });

  it('parses MCP_HTTP_PORT as integer', () => {
    process.env['MCP_HTTP_PORT'] = '9999';
    const cfg = loadConfig();
    expect(cfg.httpPort).toBe(9999);
    expect(typeof cfg.httpPort).toBe('number');
  });
});

describe('tokenFromHeaderOrEnv', () => {
  it('extracts Bearer token from Authorization header (lowercase key)', () => {
    const token = tokenFromHeaderOrEnv({ authorization: 'Bearer my-jwt-token' }, null);
    expect(token).toBe('my-jwt-token');
  });

  it('extracts Bearer token from Authorization header (original-case key)', () => {
    const token = tokenFromHeaderOrEnv({ Authorization: 'Bearer UPPER-TOKEN' }, null);
    expect(token).toBe('UPPER-TOKEN');
  });

  it('is case-insensitive for Bearer prefix', () => {
    const token = tokenFromHeaderOrEnv({ authorization: 'bearer lowercase' }, null);
    expect(token).toBe('lowercase');
  });

  it('prefers header over env token when both present', () => {
    const token = tokenFromHeaderOrEnv({ authorization: 'Bearer header-token' }, 'env-token');
    expect(token).toBe('header-token');
  });

  it('falls back to env token when no header', () => {
    const token = tokenFromHeaderOrEnv({}, 'env-fallback');
    expect(token).toBe('env-fallback');
  });

  it('throws when both header and env token are missing', () => {
    expect(() => tokenFromHeaderOrEnv({}, null)).toThrow(
      'Missing API token: set ALFY_API_TOKEN or pass Authorization: Bearer header',
    );
  });

  it('handles array header value (takes first)', () => {
    const token = tokenFromHeaderOrEnv({ authorization: ['Bearer first', 'Bearer second'] }, null);
    expect(token).toBe('first');
  });
});
