<template>
  <Badge
    variant="outline"
    class="gap-1 text-[11px] px-2 py-0.5 h-5 border-transparent rounded-full bg-muted text-muted-foreground"
  >
    <FolderOpen
      :size="11"
      :style="color ? { color } : undefined"
    />
    {{ name }}
  </Badge>
</template>

<script setup lang="ts">
import { FolderOpen } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'

defineProps<{
  name: string
  color?: string | null
}>()
</script>
