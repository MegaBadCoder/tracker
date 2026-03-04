<script setup lang="ts">
defineProps<{ value: number, color?: string }>()
</script>

<template>
  <div class="w-full h-1.5 bg-muted rounded-full overflow-hidden">
    <div
      class="h-full rounded-full transition-all duration-500"
      :style="{
        width: `${Math.min(100, Math.max(0, value))}%`,
        backgroundColor: color ?? 'var(--primary)',
      }"
    />
  </div>
</template>
