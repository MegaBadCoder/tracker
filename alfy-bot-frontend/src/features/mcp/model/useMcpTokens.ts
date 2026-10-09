import type { CreatedMcpToken, McpToken } from './types'
import { ref } from 'vue'
import { createToken, listTokens, revokeToken } from '../api/tokens'

export function useMcpTokens() {
  const tokens = ref<McpToken[]>([])
  const revealed = ref<CreatedMcpToken | null>(null)
  const loading = ref(false)
  const creating = ref(false)
  const revokingId = ref<number | null>(null)
  const loadError = ref<string | null>(null)
  const createError = ref<string | null>(null)
  const revokeError = ref<string | null>(null)

  async function fetchTokens(): Promise<void> {
    if (loading.value)
      return
    loading.value = true
    loadError.value = null
    try {
      tokens.value = await listTokens()
    }
    catch {
      loadError.value = 'Не удалось загрузить список токенов'
    }
    finally {
      loading.value = false
    }
  }

  async function refresh(): Promise<void> {
    if (creating.value || revokingId.value !== null)
      return
    await fetchTokens()
  }

  async function create(name: string): Promise<void> {
    if (creating.value || loading.value || revokingId.value !== null || !name.trim())
      return
    creating.value = true
    createError.value = null
    try {
      revealed.value = await createToken(name.trim())
      await fetchTokens()
    }
    catch {
      createError.value = 'Не удалось создать токен. Обновите список и отзовите лишний токен, если запрос всё же прошёл.'
    }
    finally {
      creating.value = false
    }
  }

  async function revoke(id: number): Promise<void> {
    if (revokingId.value !== null || loading.value || creating.value)
      return
    revokingId.value = id
    revokeError.value = null
    try {
      await revokeToken(id)
      tokens.value = tokens.value.filter(token => token.id !== id)
      if (revealed.value?.id === id)
        revealed.value = null
    }
    catch {
      revokeError.value = 'Не удалось отозвать токен'
    }
    finally {
      revokingId.value = null
    }
  }

  function dismissSecret(): void {
    revealed.value = null
  }

  return { tokens, revealed, loading, creating, revokingId, loadError, createError, revokeError, refresh, create, revoke, dismissSecret }
}
