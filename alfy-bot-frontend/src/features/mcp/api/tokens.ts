import type { CreatedMcpToken, McpToken } from '../model/types'
import { api } from '@/api/client'

const path = '/auth/api-tokens'

export async function listTokens(): Promise<McpToken[]> {
  const { data } = await api.get<McpToken[]>(path)
  return data
}

export async function createToken(name: string): Promise<CreatedMcpToken> {
  const { data } = await api.post<CreatedMcpToken>(path, { name })
  return data
}

export async function revokeToken(id: number): Promise<void> {
  await api.delete(`${path}/${id}`)
}
