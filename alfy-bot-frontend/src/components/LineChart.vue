<script setup lang="ts">
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { computed } from 'vue'
import { Line } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const props = withDefaults(
  defineProps<{
    labels: string[]
    values: number[]
    color: string
    questionText: string
    highlightIndex?: number
    bare?: boolean
  }>(),
  { highlightIndex: undefined, bare: false },
)

const color = computed(() => props.color)

const chartData = computed(() => {
  const n = props.values.length
  const hi = props.highlightIndex
  const pointRadius =
    n && hi != null
      ? Array.from({ length: n }, (_, i) => (i === hi ? 8 : 4))
      : 4
  const pointBackgroundColor =
    n && hi != null
      ? Array.from({ length: n }, (_, i) =>
          i === hi ? color.value : color.value + '80',
        )
      : color.value + '80'
  return {
    labels: props.labels,
    datasets: [
      {
        label: props.questionText,
        data: props.values,
        borderColor: color.value,
        backgroundColor: color.value + '20',
        borderWidth: 2,
        pointRadius,
        pointHoverRadius: 8,
        pointBackgroundColor,
        tension: 0.4,
        fill: true,
      },
    ],
  }
})

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: (items: { label: string }[]) => items[0]?.label ?? '',
      },
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(156,163,175,0.15)' },
      ticks: { font: { size: 11 }, maxRotation: 45 },
    },
    y: {
      grid: { color: 'rgba(156,163,175,0.15)' },
      ticks: { font: { size: 11 } },
    },
  },
}

const min = computed(() => props.values.length ? Math.min(...props.values) : 0)
const max = computed(() => props.values.length ? Math.max(...props.values) : 0)
const avg = computed(() =>
  props.values.length
    ? Math.round((props.values.reduce((a, b) => a + b, 0) / props.values.length) * 10) / 10
    : 0,
)
</script>

<template>
  <div v-if="bare" class="space-y-4">
    <div class="h-44">
      <Line :data="chartData" :options="options" />
    </div>
    <div class="flex gap-3">
      <div class="flex-1 bg-muted rounded-lg px-3 py-2 text-center">
        <div class="text-xs text-muted-foreground mb-0.5">Мин</div>
        <div class="text-sm font-semibold text-foreground">{{ min }}</div>
      </div>
      <div class="flex-1 bg-muted rounded-lg px-3 py-2 text-center">
        <div class="text-xs text-muted-foreground mb-0.5">Среднее</div>
        <div class="text-sm font-semibold text-foreground">{{ avg }}</div>
      </div>
      <div class="flex-1 bg-muted rounded-lg px-3 py-2 text-center">
        <div class="text-xs text-muted-foreground mb-0.5">Макс</div>
        <div class="text-sm font-semibold text-foreground">{{ max }}</div>
      </div>
    </div>
  </div>
  <div v-else class="bg-card border border-border rounded-xl p-5">
    <h4 class="text-sm font-semibold text-card-foreground mb-4">{{ questionText }}</h4>
    <div class="h-44">
      <Line :data="chartData" :options="options" />
    </div>
    <div class="flex gap-3 mt-4">
      <div class="flex-1 bg-muted rounded-lg px-3 py-2 text-center">
        <div class="text-xs text-muted-foreground mb-0.5">Мин</div>
        <div class="text-sm font-semibold text-foreground">{{ min }}</div>
      </div>
      <div class="flex-1 bg-muted rounded-lg px-3 py-2 text-center">
        <div class="text-xs text-muted-foreground mb-0.5">Среднее</div>
        <div class="text-sm font-semibold text-foreground">{{ avg }}</div>
      </div>
      <div class="flex-1 bg-muted rounded-lg px-3 py-2 text-center">
        <div class="text-xs text-muted-foreground mb-0.5">Макс</div>
        <div class="text-sm font-semibold text-foreground">{{ max }}</div>
      </div>
    </div>
  </div>
</template>
