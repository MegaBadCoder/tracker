<script setup lang="ts">
import { formatDate } from '../../../utils/date'

import type { DataPoint } from '../../../utils/reportAnswer'

defineProps<{
  questionText: string
  dataPoints: DataPoint[]
  accent: string
  highlightIndex?: number
}>()
</script>

<template>
  <div class="bg-card border border-border rounded-xl p-5">
    <h4 class="text-sm font-semibold text-card-foreground mb-4">{{ questionText }}</h4>
    <div class="space-y-3 max-h-80 overflow-y-auto">
      <div
        v-for="(dp, i) in dataPoints"
        :key="`${dp.date}-${i}`"
        :class="[
          'flex flex-col gap-1 px-3 py-2 rounded-lg border',
          i === highlightIndex
            ? 'border-current bg-muted'
            : 'border-transparent bg-muted/50',
        ]"
        :style="i === highlightIndex ? { borderColor: accent } : undefined"
      >
        <span class="text-xs text-muted-foreground">{{ formatDate(dp.date) }}</span>
        <p class="text-sm text-foreground whitespace-pre-wrap">
          {{ dp.value != null ? String(dp.value) : '—' }}
        </p>
      </div>
      <p v-if="!dataPoints.length" class="text-sm text-muted-foreground italic">Нет записей</p>
    </div>
  </div>
</template>
