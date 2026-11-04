<script setup lang="ts">
import type { PlanningContext } from '../model/planning-types'
import { computed } from 'vue'

const props = defineProps<{ context: PlanningContext }>()
const usable = computed(() => props.context.capacityMinutes === null ? null : props.context.capacityMinutes - props.context.reserveMinutes)
const percentage = computed(() => usable.value !== null && usable.value > 0 ? Math.min(100, props.context.plannedMinutes / usable.value * 100) : 0)
const overloaded = computed(() => props.context.remainingMinutes !== null && props.context.remainingMinutes < 0)
const hours = (minutes: number) => new Intl.NumberFormat('ru', { maximumFractionDigits: 1 }).format(minutes / 60)
</script>

<template>
  <section class="rounded-lg border border-border bg-background px-4 py-3" aria-label="Загрузка спринта">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <p class="text-sm">
        <span class="font-semibold tabular-nums">{{ hours(context.plannedMinutes) }} ч</span><span class="text-muted-foreground"> запланировано</span><span v-if="usable !== null"> / {{ hours(usable) }} ч доступно</span><span v-else class="text-muted-foreground"> · бюджет не задан</span>
      </p><p v-if="context.remainingMinutes !== null" class="text-xs font-medium" :class="overloaded ? 'text-destructive' : 'text-muted-foreground'">
        {{ overloaded ? `Перегрузка ${hours(-context.remainingMinutes)} ч` : `Осталось ${hours(context.remainingMinutes)} ч` }}
      </p>
    </div>
    <div v-if="usable !== null" class="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" :aria-valuenow="Math.round(percentage)" :aria-valuemin="0" :aria-valuemax="100" aria-label="Заполнение бюджета">
      <div class="h-full rounded-full transition-[width] motion-reduce:transition-none" :class="overloaded ? 'bg-destructive' : 'bg-primary'" :style="{ width: `${percentage}%` }" />
    </div>
    <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>Резерв {{ hours(context.reserveMinutes) }} ч</span><span :class="context.unestimatedCount > 0 && 'font-medium text-foreground'">Без оценки: {{ context.unestimatedCount }}</span><span v-if="context.otherProjectsMinutes > 0">Другие проекты в эти даты: {{ hours(context.otherProjectsMinutes) }} ч</span>
    </div>
    <p v-if="context.otherProjectsUnestimatedCount" class="mt-1 text-xs text-muted-foreground">
      В других проектах ещё {{ context.otherProjectsUnestimatedCount }} задач без оценки в пересекающихся спринтах.
    </p>
    <p v-if="context.unestimatedCount" class="mt-1 text-xs text-muted-foreground">
      Задачи без оценки не входят в часы. Реальная нагрузка может быть выше.
    </p>
    <p v-if="context.historicalCapacityMinutes !== null" class="mt-1 text-xs text-muted-foreground">
      По {{ context.historySampleCount }} прошлым спринтам: {{ hours(context.historicalCapacityMinutes) }} ч выполненных оценок за спринт. Это ориентир объёма, а не затраченное время.
    </p>
  </section>
</template>
