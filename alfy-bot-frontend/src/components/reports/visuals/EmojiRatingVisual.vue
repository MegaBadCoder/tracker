<script setup lang="ts">
import { computed } from 'vue'

import type { DataPoint } from '../../../utils/reportAnswer'

const props = defineProps<{
  questionText: string
  dataPoints: DataPoint[]
  accent: string
  highlightIndex?: number
}>()

const freqMap = computed(() => {
  const m = new Map<string, number>()
  for (const d of props.dataPoints) {
    const v = d.value != null ? String(d.value).trim() : ''
    if (v) m.set(v, (m.get(v) ?? 0) + 1)
  }
  return m
})

const sortedEntries = computed(() =>
  [...freqMap.value.entries()].sort((a, b) => b[1] - a[1]),
)

const maxCount = computed(() =>
  sortedEntries.value.length ? Math.max(...sortedEntries.value.map(([, c]) => c)) : 0,
)

const highlightedValue = computed(() => {
  const hi = props.highlightIndex
  if (hi == null || hi < 0 || hi >= props.dataPoints.length) return null
  const v = props.dataPoints[hi]?.value
  return v != null ? String(v) : null
})
</script>

<template>
  <div class="bg-card border border-border rounded-xl p-5">
    <h4 class="text-sm font-semibold text-card-foreground mb-4">{{ questionText }}</h4>
    <div v-if="highlightIndex != null && highlightedValue" class="text-5xl py-4">
      {{ highlightedValue }}
    </div>
    <div v-else class="space-y-3">
      <div
        v-for="[emoji, count] in sortedEntries"
        :key="emoji"
        class="flex items-center gap-3"
      >
        <span class="text-2xl w-10 text-center shrink-0">{{ emoji }}</span>
        <div class="flex-1 h-6 bg-muted rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            :style="{
              width: maxCount ? `${(count / maxCount) * 100}%` : '0%',
              backgroundColor: accent,
            }"
          />
        </div>
        <span class="text-sm text-muted-foreground w-6">{{ count }}</span>
      </div>
      <p v-if="!sortedEntries.length" class="text-sm text-muted-foreground italic">Нет данных</p>
    </div>
  </div>
</template>
