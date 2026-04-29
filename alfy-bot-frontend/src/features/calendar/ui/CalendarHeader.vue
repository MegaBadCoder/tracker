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
    </div>
    <span class="text-sm font-medium capitalize">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

defineProps<{
  label: string
}>()

defineEmits<{
  navigate: [direction: number]
  today: []
}>()
</script>
