export interface McpToken {
  id: number
  name: string
  prefix: string
  created_at: string
  last_used_at: string | null
}

export interface CreatedMcpToken {
  id: number
  plaintext: string
}
