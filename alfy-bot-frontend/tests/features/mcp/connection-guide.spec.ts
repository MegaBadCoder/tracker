import { describe, expect, it } from 'vitest'
import { buildConnectionGuide, resolveMcpUrl } from '@/features/mcp/lib/connection-guide'

describe('адрес MCP', () => {
  it('использует текущий origin без настройки', () => {
    expect(resolveMcpUrl(undefined, 'https://tracker.example')).toBe('https://tracker.example/mcp')
  })

  it('использует явный локальный адрес', () => {
    expect(resolveMcpUrl('http://localhost:3003/mcp', 'https://tracker.example')).toBe('http://localhost:3003/mcp')
  })

  it('отклоняет неподдерживаемый протокол', () => {
    expect(() => resolveMcpUrl('javascript:alert(1)', 'https://tracker.example')).toThrow()
  })

  it('отклоняет относительную явную настройку', () => {
    expect(() => resolveMcpUrl('another-path', 'https://tracker.example')).toThrow()
  })
})

describe('инструкции подключения', () => {
  it('не включает реальный секрет и экранирует адрес в TOML и JSON', () => {
    const url = 'https://example.com/mcp?name="x"&part=\'y\''
    const guide = buildConnectionGuide(url)
    expect(guide.codex).toContain('bearer_token_env_var = "ALFY_MCP_TOKEN"')
    expect(guide.codex).toContain('name=\\"x\\"')
    expect(JSON.parse(guide.claudeCode)).toEqual({ mcpServers: { alfy: { type: 'http', url, headers: { Authorization: `Bearer \${ALFY_MCP_TOKEN}` } } } })
    expect(guide.generic).toContain('YOUR_ALFY_TOKEN')
    expect(JSON.stringify(guide)).not.toContain('secret-from-user')
  })
})
