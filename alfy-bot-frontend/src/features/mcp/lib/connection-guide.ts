export interface ConnectionGuide {
  codex: string
  claudeCode: string
  generic: string
}

const singleQuote = /'/g

export function resolveMcpUrl(override: string | undefined, origin: string): string {
  const url = override?.trim() ? new URL(override.trim()) : new URL('/mcp', origin)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error('Адрес MCP должен использовать HTTP или HTTPS без логина и фрагмента')
  }
  return url.toString()
}

function shellQuote(value: string): string {
  return `'${value.replace(singleQuote, '\'\\\'\'')}'`
}

export function buildConnectionGuide(url: string): ConnectionGuide {
  const encodedUrl = JSON.stringify(url)
  return {
    codex: `[mcp_servers.alfy]\nurl = ${encodedUrl}\nbearer_token_env_var = "ALFY_MCP_TOKEN"`,
    claudeCode: `claude mcp add --transport http alfy ${shellQuote(url)} --header 'Authorization: Bearer YOUR_ALFY_TOKEN'`,
    generic: JSON.stringify({ type: 'http', url, headers: { Authorization: 'Bearer YOUR_ALFY_TOKEN' } }, null, 2),
  }
}
