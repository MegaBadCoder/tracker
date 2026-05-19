<script setup lang="ts">
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import { Button } from '@/components/ui/button'

defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'setCanSkip', v: boolean): void
  (e: 'back'): void
}>()
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      Можно ли пропустить этот вопрос?
    </h2>

    <div class="flex gap-2">
      <Button @click="emit('setCanSkip', true)">
        Да
      </Button>
      <Button variant="outline" @click="emit('setCanSkip', false)">
        Нет
      </Button>
    </div>

    <div>
      <Button variant="outline" @click="emit('back')">
        ⬅️ Назад
      </Button>
    </div>
  </div>
</template>
