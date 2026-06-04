<script setup lang="ts">
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import { CircleCheck } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'offerQuestions', yes: boolean): void
}>()
</script>

<template>
  <div class="space-y-4">
    <p class="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
      <CircleCheck class="size-4" />
      Цель поставлена!
    </p>

    <h2 class="text-lg font-semibold">
      Хочешь настроить вопросы для отчётов?
    </h2>

    <div class="flex gap-2">
      <Button @click="emit('offerQuestions', true)">
        Да, настроить
      </Button>
      <Button variant="outline" @click="emit('offerQuestions', false)">
        Пропустить
      </Button>
    </div>
  </div>
</template>
