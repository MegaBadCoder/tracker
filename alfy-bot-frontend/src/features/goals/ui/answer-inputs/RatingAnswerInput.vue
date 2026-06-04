<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { ratingAnswer } from '@/features/goals/lib/answer-format'
import { findQuestionTypeOption } from '@/features/goals/ui/steps/question-types'

const emit = defineEmits<{
  (e: 'submit', answer: string): void
}>()

// Числа 1..5 из единого конфига типов
const options = findQuestionTypeOption('rating').options as number[]

function pick(n: number) {
  emit('submit', ratingAnswer(n))
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <Button
      v-for="n in options"
      :key="n"
      variant="outline"
      size="lg"
      :data-testid="`rating-${n}`"
      @click="pick(n)"
    >
      {{ n }}
    </Button>
  </div>
</template>
