<script setup lang="ts">
import { computed } from 'vue'
import type { Question } from '../../../types'
import type { DataPoint } from '../../../utils/reportAnswer'
import type { PhotoGalleryEntry } from '../../../api/reports'
import NumericVisual from './NumericVisual.vue'
import YesNoVisual from './YesNoVisual.vue'
import EmojiRatingVisual from './EmojiRatingVisual.vue'
import TextLogVisual from './TextLogVisual.vue'
import PhotoGalleryVisual from './PhotoGalleryVisual.vue'

export type { DataPoint }

const props = defineProps<{
  question: Question
  dataPoints: DataPoint[]
  accent: string
  highlightIndex?: number
  photoEntries?: PhotoGalleryEntry[]
}>()

const isNumeric = (t: string) => ['number', 'rating', 'time_spent'].includes(t)

const targetValue = computed(() => {
  if (props.question.target_value == null) return undefined
  const v = parseFloat(props.question.target_value)
  return Number.isNaN(v) ? undefined : v
})

</script>

<template>
  <PhotoGalleryVisual
    v-if="question.type === 'photo'"
    :question-text="question.question"
    :entries="photoEntries ?? []"
  />
  <NumericVisual
    v-else-if="isNumeric(question.type)"
    :question-text="question.question"
    :data-points="dataPoints"
    :accent="accent"
    :highlight-index="highlightIndex"
    :target-value="targetValue"
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
