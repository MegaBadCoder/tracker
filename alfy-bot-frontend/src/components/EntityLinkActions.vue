<script setup lang="ts">
import { ExternalLink, Link } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'

const props = defineProps<{ path: string | null, label: string }>()
const link = computed(() => {
  const path = props.path
  return path ? new URL(path, window.location.origin).href : null
})
const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
watch(() => props.path, () => {
  status.value = 'idle'
})

async function copyLink() {
  const value = link.value
  if (!value || status.value === 'pending')
    return
  status.value = 'pending'
  try {
    await navigator.clipboard.writeText(value)
    if (value === link.value)
      status.value = 'success'
  }
  catch {
    if (value === link.value)
      status.value = 'error'
  }
}
</script>

<template>
  <div v-if="link" class="relative flex shrink-0 items-center gap-0.5">
    <Button variant="ghost" size="icon-sm" type="button" :disabled="status === 'pending'" :aria-label="`Копировать ссылку на ${label}`" :title="`Копировать ссылку на ${label}`" @click="copyLink">
      <Link :size="16" />
    </Button>
    <Button as-child variant="ghost" size="icon-sm">
      <a :href="link" target="_blank" rel="noopener noreferrer" :aria-label="`Открыть ${label} в новой вкладке`" :title="`Открыть ${label} в новой вкладке`">
        <ExternalLink :size="16" />
      </a>
    </Button>
    <p v-if="status === 'success' || status === 'error'" :role="status === 'error' ? 'alert' : 'status'" class="absolute right-0 top-full z-10 mt-1 w-56 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md">
      {{ status === 'success' ? 'Ссылка скопирована' : 'Не удалось скопировать ссылку. Откройте её в новой вкладке и скопируйте адрес.' }}
    </p>
  </div>
</template>
