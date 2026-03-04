<script setup lang="ts">
import { ArcElement, Chart as ChartJS, Tooltip } from 'chart.js'
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'

ChartJS.register(ArcElement, Tooltip)

import type { DataPoint } from '../../../utils/reportAnswer'

const props = defineProps<{
  questionText: string
  dataPoints: DataPoint[]
  accent: string
  highlightIndex?: number
}>()

const yesCount = computed(() =>
  props.dataPoints.filter(d => {
    const v = d.value
    return v === true || v === 'true' || v === 'Да' || v === 'да' || v === 'yes' || v === 1
  }).length,
)
const noCount = computed(() =>
  props.dataPoints.filter(d => {
    const v = d.value
    return v === false || v === 'false' || v === 'Нет' || v === 'нет' || v === 'no' || v === 0
  }).length,
)

const highlightedValue = computed((): boolean | null => {
  const hi = props.highlightIndex
  if (hi == null || hi < 0 || hi >= props.dataPoints.length) return null
  const v = props.dataPoints[hi]?.value
  if (v === true || v === 'true' || v === 'Да' || v === 'да' || v === 'yes' || v === 1) return true
  if (v === false || v === 'false' || v === 'Нет' || v === 'нет' || v === 'no' || v === 0) return false
  return null
})

const chartData = computed(() => ({
  labels: ['Да', 'Нет'],
  datasets: [
    {
      data: [yesCount.value, noCount.value],
      backgroundColor: [props.accent, '#e5e7eb'],
      borderWidth: 0,
      hoverOffset: 4,
    },
  ],
}))

const options = {
  cutout: '65%',
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { label: string, parsed: number }) => ` ${ctx.label}: ${ctx.parsed}`,
      },
    },
  },
  responsive: true,
  maintainAspectRatio: true,
}

const total = computed(() => yesCount.value + noCount.value)
const yesPct = computed(() => (total.value ? Math.round((yesCount.value / total.value) * 100) : 0))
</script>

<template>
  <div class="bg-card border border-border rounded-xl p-5">
    <h4 class="text-sm font-semibold text-card-foreground mb-4">{{ questionText }}</h4>
    <div v-if="highlightIndex != null && highlightedValue != null" class="mb-4">
      <span
        :class="[
          'inline-block px-4 py-2 rounded-lg text-lg font-semibold',
          highlightedValue
            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        ]"
      >
        {{ highlightedValue ? 'Да' : 'Нет' }}
      </span>
    </div>
    <div v-else class="flex flex-col items-center">
      <div class="relative w-40 h-40">
        <Doughnut :data="chartData" :options="options" />
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span class="text-2xl font-bold text-foreground">{{ yesPct }}%</span>
          <span class="text-xs text-muted-foreground">Да</span>
        </div>
      </div>
      <div class="flex gap-4 mt-4">
        <span class="text-sm text-muted-foreground">Да: {{ yesCount }}</span>
        <span class="text-sm text-muted-foreground">Нет: {{ noCount }}</span>
      </div>
    </div>
  </div>
</template>
