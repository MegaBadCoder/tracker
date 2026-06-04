<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { timeSpentAnswer } from '@/features/goals/lib/answer-format'
import { findQuestionTypeOption } from '@/features/goals/ui/steps/question-types'

const emit = defineEmits<{
  (e: 'submit', answer: string): void
}>()

// Лейблы диапазонов из единого конфига; submit шлёт лейбл как есть
const labels = findQuestionTypeOption('time_spent').options as string[]

function pick(label: string) {
  emit('submit', timeSpentAnswer(label))
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <Button
      v-for="label in labels"
      :key="label"
      variant="outline"
      size="lg"
      :data-testid="`time-${label}`"
      @click="pick(label)"
    >
      {{ label }}
    </Button>
  </div>
</template>
