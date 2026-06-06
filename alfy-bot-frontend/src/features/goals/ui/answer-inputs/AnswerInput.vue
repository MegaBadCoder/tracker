<script setup lang="ts">
import type { QuestionType } from '@/types'
import EmojiRatingAnswerInput from './EmojiRatingAnswerInput.vue'
import NumberAnswerInput from './NumberAnswerInput.vue'
import PhotoAnswerInput from './PhotoAnswerInput.vue'
import RatingAnswerInput from './RatingAnswerInput.vue'
import TextAnswerInput from './TextAnswerInput.vue'
import TimeSpentAnswerInput from './TimeSpentAnswerInput.vue'
import YesNoAnswerInput from './YesNoAnswerInput.vue'

/**
 * Роутер по `type` → нужный answer-input (зеркало QuestionVisual).
 * Принимает только тип вопроса (единственное, что нужно для выбора инпута),
 * чтобы одинаково работать и с `Question`, и с `QuestionReportItem`.
 * Потребляется в Phase 4: `<AnswerInput :type @submit @submitPhoto>`.
 */
defineProps<{
  type: QuestionType
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
    v-if="type === 'photo'"
    @submit-photo="onSubmitPhoto"
  />
  <RatingAnswerInput
    v-else-if="type === 'rating'"
    @submit="onSubmit"
  />
  <EmojiRatingAnswerInput
    v-else-if="type === 'emoji_rating'"
    @submit="onSubmit"
  />
  <YesNoAnswerInput
    v-else-if="type === 'yes_no'"
    @submit="onSubmit"
  />
  <TimeSpentAnswerInput
    v-else-if="type === 'time_spent'"
    @submit="onSubmit"
  />
  <NumberAnswerInput
    v-else-if="type === 'number'"
    @submit="onSubmit"
  />
  <TextAnswerInput
    v-else
    @submit="onSubmit"
  />
</template>
