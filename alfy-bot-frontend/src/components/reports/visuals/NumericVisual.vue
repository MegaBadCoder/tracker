<script setup lang="ts">
import { computed } from 'vue'
import LineChart from '../../LineChart.vue'
import { formatDateShort } from '../../../utils/date'

import type { DataPoint } from '../../../utils/reportAnswer'

const props = defineProps<{
  questionText: string
  dataPoints: DataPoint[]
  accent: string
  highlightIndex?: number
  targetValue?: number
}>()

const labels = computed(() => props.dataPoints.map(d => formatDateShort(d.date)))
const values = computed(() =>
  props.dataPoints.map(d => {
    if (typeof d.value === 'number' && !Number.isNaN(d.value)) return d.value
    if (typeof d.value === 'string') {
      const n = parseFloat(d.value)
      return Number.isNaN(n) ? 0 : n
    }
    return 0
  }),
)

const highlightedValue = computed(() => {
  const hi = props.highlightIndex
  if (hi == null || hi < 0 || hi >= props.dataPoints.length) return null
  const v = props.dataPoints[hi]?.value
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v) || null
  if (typeof v === 'boolean') return v ? 1 : 0
  return null
})

const numericValues = computed(() => values.value.filter(v => typeof v === 'number' && !Number.isNaN(v)))
const avg = computed(() =>
  numericValues.value.length
    ? Math.round((numericValues.value.reduce((a, b) => a + b, 0) / numericValues.value.length) * 10) / 10
    : null,
)
</script>

<template>
  <div class="bg-card border border-border rounded-xl p-5">
    <h4 class="text-sm font-semibold text-card-foreground mb-4">{{ questionText }}</h4>
    <div v-if="highlightIndex != null && highlightedValue != null" class="flex items-baseline gap-3 mb-4">
      <span class="text-3xl font-bold" :style="{ color: accent }">{{ highlightedValue }}</span>
      <span v-if="avg != null" class="text-sm text-muted-foreground">· среднее {{ avg }}</span>
    </div>
    <LineChart
      :labels="labels"
      :values="values"
      :color="accent"
      :question-text="questionText"
      :highlight-index="highlightIndex"
      :bare="true"
      :target-value="targetValue"
    />
  </div>
</template>
