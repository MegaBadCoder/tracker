<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { yesNoAnswer } from '@/features/goals/lib/answer-format'
import { findQuestionTypeOption } from '@/features/goals/ui/steps/question-types'

const emit = defineEmits<{
  (e: 'submit', answer: string): void
}>()

// Лейблы «Да»/«Нет» из единого конфига; submit шлёт "yes"/"no"
const [yesLabel, noLabel] = findQuestionTypeOption('yes_no').options as string[]

function pick(yes: boolean) {
  emit('submit', yesNoAnswer(yes))
}
</script>

<template>
  <div class="flex gap-2">
    <Button
      variant="outline"
      size="lg"
      data-testid="yesno-yes"
      @click="pick(true)"
    >
      {{ yesLabel }}
    </Button>
    <Button
      variant="outline"
      size="lg"
      data-testid="yesno-no"
      @click="pick(false)"
    >
      {{ noLabel }}
    </Button>
  </div>
</template>
