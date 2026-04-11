<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <main :class="cn('w-full max-w-6xl mx-auto px-4 py-6', $props.class)">
    <slot />
  </main>
</template>
