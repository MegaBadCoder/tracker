<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  showIcon?: boolean
  class?: HTMLAttributes['class']
}>()

const width = computed(() => {
  return `${Math.floor(Math.random() * 40) + 50}%`
})
</script>

<template>
  <div
    data-slot="sidebar-menu-skeleton"
    data-sidebar="menu-skeleton"
    :class="cn('flex h-8 items-center gap-2 rounded-md px-2', props.class)"
  >
    <div
      v-if="showIcon"
      class="size-4 rounded-md bg-sidebar-accent animate-pulse"
      data-sidebar="menu-skeleton-icon"
    />
    <div
      class="h-4 max-w-(--skeleton-width) flex-1 bg-sidebar-accent animate-pulse rounded"
      data-sidebar="menu-skeleton-text"
      :style="{ '--skeleton-width': width }"
    />
  </div>
</template>
