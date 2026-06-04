<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { emojiRatingAnswer } from '@/features/goals/lib/answer-format'
import { findQuestionTypeOption } from '@/features/goals/ui/steps/question-types'

const emit = defineEmits<{
  (e: 'submit', answer: string): void
}>()

// Эмодзи для отрисовки кнопок из единого конфига; в submit идёт 1-based индекс
const emojis = findQuestionTypeOption('emoji_rating').options as string[]

function pick(index0based: number) {
  emit('submit', emojiRatingAnswer(index0based + 1))
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <Button
      v-for="(emoji, i) in emojis"
      :key="i"
      variant="outline"
      size="lg"
      class="text-xl"
      :data-testid="`emoji-${i}`"
      @click="pick(i)"
    >
      {{ emoji }}
    </Button>
  </div>
</template>
