<script setup lang="ts">
import type { Question } from '../../../types'
import type { DataPoint } from '../../../utils/reportAnswer'
import NumericVisual from './NumericVisual.vue'
import YesNoVisual from './YesNoVisual.vue'
import EmojiRatingVisual from './EmojiRatingVisual.vue'
import TextLogVisual from './TextLogVisual.vue'

export type { DataPoint }

const props = defineProps<{
  question: Question
  dataPoints: DataPoint[]
  accent: string
  highlightIndex?: number
}>()

const isNumeric = (t: string) => ['number', 'rating', 'time_spent'].includes(t)
</script>

<template>
  <NumericVisual
    v-if="isNumeric(question.type)"
    :question-text="question.question"
    :data-points="dataPoints"
    :accent="accent"
    :highlight-index="highlightIndex"
  />
  <YesNoVisual
    v-else-if="question.type === 'yes_no'"
    :question-text="question.question"
    :data-points="dataPoints"
    :accent="accent"
    :highlight-index="highlightIndex"
  />
  <EmojiRatingVisual
    v-else-if="question.type === 'emoji_rating'"
    :question-text="question.question"
    :data-points="dataPoints"
    :accent="accent"
    :highlight-index="highlightIndex"
  />
  <TextLogVisual
    v-else
    :question-text="question.question"
    :data-points="dataPoints"
    :accent="accent"
    :highlight-index="highlightIndex"
  />
</template>
