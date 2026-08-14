<script setup lang="ts">
import type { CalendarViewMode } from '../model/types'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

defineProps<{
  label: string
  viewMode: CalendarViewMode
}>()

defineEmits<{
  'navigate': [direction: number]
  'today': []
  'update:viewMode': [value: CalendarViewMode]
}>()

function tabClass(active: boolean) {
  return [
    'h-7 rounded px-2.5 text-xs font-medium transition-colors cursor-pointer',
    active
      ? 'bg-background shadow-sm text-foreground'
      : 'text-muted-foreground hover:text-foreground',
  ]
}
</script>

<template>
  <div class="flex items-center justify-between px-4 py-3">
    <div class="flex items-center gap-2">
      <Button variant="outline" size="icon-sm" @click="$emit('navigate', -1)">
        <ChevronLeft :size="16" />
      </Button>
      <Button variant="outline" size="icon-sm" @click="$emit('navigate', 1)">
        <ChevronRight :size="16" />
      </Button>
      <Button variant="outline" size="sm" @click="$emit('today')">
        Сегодня
      </Button>
      <div class="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
        <button
          type="button"
          :class="tabClass(viewMode === 'week')"
          :aria-pressed="viewMode === 'week'"
          aria-label="Неделя"
          @click="viewMode !== 'week' && $emit('update:viewMode', 'week')"
        >
          Неделя
        </button>
        <button
          type="button"
          :class="tabClass(viewMode === 'day')"
          :aria-pressed="viewMode === 'day'"
          aria-label="День"
          @click="viewMode !== 'day' && $emit('update:viewMode', 'day')"
        >
          День
        </button>
      </div>
    </div>
    <span class="text-sm font-medium capitalize">{{ label }}</span>
  </div>
</template>
