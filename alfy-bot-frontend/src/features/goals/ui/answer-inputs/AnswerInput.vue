<script setup lang="ts">
import type { Question } from '@/types'
import EmojiRatingAnswerInput from './EmojiRatingAnswerInput.vue'
import NumberAnswerInput from './NumberAnswerInput.vue'
import PhotoAnswerInput from './PhotoAnswerInput.vue'
import RatingAnswerInput from './RatingAnswerInput.vue'
import TextAnswerInput from './TextAnswerInput.vue'
import TimeSpentAnswerInput from './TimeSpentAnswerInput.vue'
import YesNoAnswerInput from './YesNoAnswerInput.vue'

/**
 * Роутер по `question.type` → нужный answer-input (зеркало QuestionVisual).
 * Принимает весь объект вопроса; пробрасывает оба эмита наверх.
 * Потребляется в Phase 4: `<AnswerInput :question @submit @submitPhoto>`.
 */
defineProps<{
  question: Question
}>()

const emit = defineEmits<{
  (e: 'submit', answer: string): void
  (e: 'submitPhoto', file: File): void
}>()

function onSubmit(answer: string) {
  emit('submit', answer)
}

function onSubmitPhoto(file: File) {
  emit('submitPhoto', file)
}
</script>

<template>
  <PhotoAnswerInput
    v-if="question.type === 'photo'"
    @submit-photo="onSubmitPhoto"
  />
  <RatingAnswerInput
    v-else-if="question.type === 'rating'"
    @submit="onSubmit"
  />
  <EmojiRatingAnswerInput
    v-else-if="question.type === 'emoji_rating'"
    @submit="onSubmit"
  />
  <YesNoAnswerInput
    v-else-if="question.type === 'yes_no'"
    @submit="onSubmit"
  />
  <TimeSpentAnswerInput
    v-else-if="question.type === 'time_spent'"
    @submit="onSubmit"
  />
  <NumberAnswerInput
    v-else-if="question.type === 'number'"
    @submit="onSubmit"
  />
  <TextAnswerInput
    v-else
    @submit="onSubmit"
  />
</template>
