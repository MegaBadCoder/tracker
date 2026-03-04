<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}>()
</script>

<template>
  <div class="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
    <span class="text-xs text-muted-foreground font-medium uppercase tracking-wide">{{ label }}</span>
    <span :class="['text-2xl font-bold', accent ? 'text-primary' : 'text-foreground']">{{ value }}</span>
    <span v-if="sub" class="text-xs text-muted-foreground">{{ sub }}</span>
  </div>
</template>
