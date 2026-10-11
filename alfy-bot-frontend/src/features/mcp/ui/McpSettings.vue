<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/composables/useConfirm'
import { intlLocale } from '@/composables/useLocale'
import { useMcpTokens } from '../model/useMcpTokens'
import McpConnectionGuide from './McpConnectionGuide.vue'

const name = ref('')
const copyError = ref<string | null>(null)
const copied = ref(false)
const { confirm } = useConfirm()
const { tokens, revealed, loading, creating, revokingId, loadError, createError, revokeError, refresh, create, revoke, dismissSecret } = useMcpTokens()

onMounted(refresh)

async function submit(): Promise<void> {
  if (creating.value || loading.value || revokingId.value !== null)
    return
  copyError.value = null
  copied.value = false
  await create(name.value)
  if (!createError.value)
    name.value = ''
}

async function confirmRevoke(id: number, tokenName: string): Promise<void> {
  if (revokingId.value !== null)
    return
  const accepted = await confirm({
    title: 'Отозвать токен?',
    message: `Агент с токеном «${tokenName}» сразу потеряет доступ.`,
    confirmText: 'Отозвать',
    variant: 'destructive',
  })
  if (accepted)
    await revoke(id)
}

async function copySecret(): Promise<void> {
  if (!revealed.value)
    return
  copyError.value = null
  copied.value = false
  try {
    await navigator.clipboard.writeText(revealed.value.plaintext)
    copied.value = true
  }
  catch {
    copyError.value = 'Не удалось скопировать токен. Выделите текст вручную.'
  }
}

function selectSecret(event: FocusEvent): void {
  (event.target as HTMLTextAreaElement).select()
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(intlLocale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
</script>

<template>
  <section class="space-y-5 border-t border-border pt-6" aria-labelledby="mcp-heading">
    <div class="space-y-2">
      <h2 id="mcp-heading" class="text-base font-semibold">
        MCP и агенты
      </h2>
      <p class="text-sm text-muted-foreground">
        Токен даёт агенту доступ к вашим данным, включая создание и изменение задач. Храните его как пароль.
      </p>
    </div>

    <form class="space-y-2" @submit.prevent="submit">
      <label for="mcp-token-name" class="text-sm font-medium">Название токена</label>
      <Input id="mcp-token-name" v-model="name" data-testid="mcp-token-name" placeholder="Например, Claude на ноутбуке" maxlength="100" required />
      <Button data-testid="mcp-create" type="submit" :disabled="creating || loading || revokingId !== null || !name.trim()" class="w-full sm:w-auto">
        {{ creating ? 'Создаём…' : 'Создать токен' }}
      </Button>
      <p v-if="createError" class="text-sm text-destructive" role="alert">
        {{ createError }}
      </p>
    </form>

    <div v-if="revealed" class="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/5 p-4">
      <p class="text-sm font-medium">
        Скопируйте токен сейчас: позже его нельзя будет посмотреть снова.
      </p>
      <textarea data-testid="mcp-secret" :value="revealed.plaintext" readonly rows="2" aria-label="Выданный токен" class="w-full resize-none rounded-md border border-border bg-background p-2 text-sm font-mono break-all" @focus="selectSecret" />
      <div class="flex flex-wrap gap-2">
        <Button data-testid="mcp-copy-secret" type="button" size="sm" @click="copySecret">
          Копировать токен
        </Button>
        <Button type="button" variant="outline" size="sm" @click="dismissSecret">
          Скрыть
        </Button>
      </div>
      <p v-if="copyError" class="text-sm text-destructive" role="alert">
        {{ copyError }}
      </p>
      <p v-if="copied" class="text-sm text-emerald-600" aria-live="polite">
        Токен скопирован
      </p>
    </div>

    <div class="space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-medium">
          Ваши токены
        </h3>
        <Button type="button" variant="outline" size="sm" :disabled="loading || creating || revokingId !== null" @click="refresh">
          Обновить
        </Button>
      </div>
      <p v-if="loadError" class="text-sm text-destructive" role="alert">
        {{ loadError }}
      </p>
      <p v-if="loading" class="text-sm text-muted-foreground">
        Загружаем…
      </p>
      <p v-else-if="tokens.length === 0" class="text-sm text-muted-foreground">
        Токенов пока нет.
      </p>
      <ul v-else class="divide-y divide-border rounded-md border border-border">
        <li v-for="token in tokens" :key="token.id" class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0 text-sm">
            <p class="font-medium break-words">
              {{ token.name }}
            </p>
            <p class="text-muted-foreground font-mono">
              {{ token.prefix }}…
            </p>
            <p class="text-xs text-muted-foreground">
              Создан: {{ formatDate(token.created_at) }}
            </p>
            <p class="text-xs text-muted-foreground">
              Последнее использование: {{ token.last_used_at ? formatDate(token.last_used_at) : 'ещё не использовался' }}
            </p>
          </div>
          <Button :data-testid="`mcp-revoke-${token.id}`" type="button" variant="destructive" size="sm" :disabled="revokingId !== null || loading || creating" @click="confirmRevoke(token.id, token.name)">
            Отозвать
          </Button>
        </li>
      </ul>
      <p v-if="revokeError" class="text-sm text-destructive" role="alert">
        {{ revokeError }}
      </p>
    </div>

    <McpConnectionGuide />
  </section>
</template>
