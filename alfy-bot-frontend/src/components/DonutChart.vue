<script setup lang="ts">
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js'
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  completed: number
  skipped: number
  inProgress: number
  color: string
}>()

const chartData = computed(() => ({
  labels: ['Выполнено', 'Пропущено', 'В процессе'],
  datasets: [
    {
      data: [props.completed, props.skipped, props.inProgress],
      backgroundColor: [props.color, '#e5e7eb', '#fbbf24'],
      borderWidth: 0,
      hoverOffset: 4,
    },
  ],
}))

const options = {
  cutout: '72%',
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

const total = computed(() => props.completed + props.skipped + props.inProgress)
const pct = computed(() => total.value ? Math.round((props.completed / total.value) * 100) : 0)
</script>

<template>
  <div class="flex flex-col items-center justify-center">
    <div class="relative w-52 h-52">
      <Doughnut :data="chartData" :options="options" />
      <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span class="text-3xl font-bold text-foreground">{{ pct }}%</span>
        <span class="text-xs text-muted-foreground">выполнено</span>
      </div>
    </div>
    <div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: color }" />
        <span class="text-sm text-muted-foreground">Выполнено: {{ completed }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-muted-foreground/40 shrink-0" />
        <span class="text-sm text-muted-foreground">Пропущено: {{ skipped }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
        <span class="text-sm text-muted-foreground">В процессе: {{ inProgress }}</span>
      </div>
    </div>
  </div>
</template>
