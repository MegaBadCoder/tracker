<script setup lang="ts">
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import { Button } from '@/components/ui/button'

defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'back'): void
}>()
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-md border border-border bg-muted/40 p-4 text-sm whitespace-pre-line">
      🚧 Этот тип цели в разработке

      Пока доступны только простые цели.
    </div>

    <Button variant="outline" @click="emit('back')">
      ⬅️ Назад к выбору типа
    </Button>
  </div>
</template>
