<template>
  <div class="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
    <button
      :class="[
        'p-1.5 rounded transition-colors cursor-pointer',
        modelValue === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
      ]"
      :aria-pressed="modelValue === 'list'"
      aria-label="Список"
      @click="modelValue !== 'list' && $emit('update:modelValue', 'list')"
    >
      <LayoutList :size="16" />
    </button>
    <button
      :class="[
        'p-1.5 rounded transition-colors cursor-pointer',
        modelValue === 'board' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
      ]"
      :aria-pressed="modelValue === 'board'"
      aria-label="Доска"
      @click="modelValue !== 'board' && $emit('update:modelValue', 'board')"
    >
      <Columns3 :size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { LayoutList, Columns3 } from 'lucide-vue-next'
import type { ViewMode } from '../model/types'

defineProps<{
  modelValue: ViewMode
}>()

defineEmits<{
  'update:modelValue': [value: ViewMode]
}>()
</script>
