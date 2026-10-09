<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { buildConnectionGuide, resolveMcpUrl } from '../lib/connection-guide'

const copyError = ref<string | null>(null)
const copied = ref(false)
const configError = ref<string | null>(null)
let url = ''
try {
  url = resolveMcpUrl(import.meta.env.VITE_MCP_URL, window.location.origin)
}
catch {
  configError.value = 'Адрес MCP недоступен. Обратитесь к администратору.'
}

const examples = computed(() => {
  if (configError.value)
    return []
  const guide = buildConnectionGuide(url)
  return [
    { title: 'Codex · ~/.codex/config.toml', code: guide.codex },
    { title: 'Claude Code · терминал', code: guide.claudeCode },
    { title: 'Другой HTTP-клиент', code: guide.generic },
  ]
})

async function copy(value: string): Promise<void> {
  copyError.value = null
  copied.value = false
  try {
    await navigator.clipboard.writeText(value)
    copied.value = true
  }
  catch {
    copyError.value = 'Не удалось скопировать инструкцию. Выделите текст вручную.'
  }
}
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-sm font-medium">
      Подключение агента
    </h3>
    <p class="text-sm text-muted-foreground">
      Сервер MCP: <code class="break-all">{{ url }}</code>
    </p>
    <p v-if="configError" class="text-sm text-destructive" role="alert">
      {{ configError }}
    </p>
    <template v-else>
      <p class="text-sm text-muted-foreground">
        Для Codex сохраните пример в ~/.codex/config.toml, задайте переменную окружения перед запуском и проверьте список MCP-инструментов после перезапуска. Для Claude Code замените placeholder токена и выполните команду. Примеры не содержат выданный секрет.
      </p>
      <pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs"><code>export ALFY_MCP_TOKEN='YOUR_ALFY_TOKEN'</code></pre>
      <div v-for="item in examples" :key="item.title" class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <h4 class="text-sm font-medium">
            {{ item.title }}
          </h4>
          <Button type="button" variant="outline" size="sm" @click="copy(item.code)">
            Копировать
          </Button>
        </div>
        <pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-all"><code>{{ item.code }}</code></pre>
      </div>
      <p v-if="copyError" class="text-sm text-destructive" role="alert">
        {{ copyError }}
      </p>
      <p v-if="copied" class="text-sm text-emerald-600" aria-live="polite">
        Инструкция скопирована
      </p>
    </template>
  </div>
</template>
