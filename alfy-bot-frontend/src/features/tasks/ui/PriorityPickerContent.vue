<template>
  <div class="space-y-1">
    <button
      v-for="p in PRIORITIES"
      :key="p"
      class="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-sm hover:bg-muted/60 transition-colors cursor-pointer"
      @click="$emit('update:modelValue', p)"
    >
      <Flag :size="14" :class="getPriorityColor(p)" />
      {{ PRIORITY_LABELS[p] }}
    </button>
    <button
      v-if="modelValue"
      class="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:bg-muted/60 transition-colors cursor-pointer"
      @click="$emit('update:modelValue', undefined)"
    >
      <X :size="14" />
      Убрать
    </button>
  </div>
</template>

<script setup lang="ts">
import { Flag, X } from 'lucide-vue-next'
import type { Priority } from '../model/types'
import { PRIORITY_LABELS, PRIORITIES } from '../model/constants'
import { getPriorityColor } from '../lib/priority'

defineProps<{
  modelValue: Priority | undefined
}>()

defineEmits<{
  (e: 'update:modelValue', value: Priority | undefined): void
}>()
</script>
