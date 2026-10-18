<script setup lang="ts">
import { ArrowDown, ArrowUp } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

defineProps<{
  label: string
  canMoveUp: boolean
  canMoveDown: boolean
  pending: boolean
}>()

defineEmits<{
  move: [direction: -1 | 1]
}>()
</script>

<template>
  <div class="flex items-center shrink-0">
    <Button
      variant="ghost"
      size="icon-sm"
      class="text-muted-foreground hover:text-foreground"
      :aria-label="`Переместить ${label} выше`"
      :title="`Переместить ${label} выше`"
      :disabled="pending || !canMoveUp"
      @click="$emit('move', -1)"
    >
      <ArrowUp :size="14" />
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      class="text-muted-foreground hover:text-foreground"
      :aria-label="`Переместить ${label} ниже`"
      :title="`Переместить ${label} ниже`"
      :disabled="pending || !canMoveDown"
      @click="$emit('move', 1)"
    >
      <ArrowDown :size="14" />
    </Button>
  </div>
</template>
