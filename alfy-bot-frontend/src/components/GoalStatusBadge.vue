<script setup lang="ts">
import type { GoalOutcome, GoalStatus } from '../types'

const props = defineProps<{ status: GoalStatus, outcome?: GoalOutcome | null }>()

const config: Record<GoalStatus, { label: string, classes: string, dot: string }> = {
  active: {
    label: 'Активна',
    classes: 'text-green-700 dark:text-green-400',
    dot: 'bg-green-500',
  },
  completed: {
    label: 'Достигнута',
    classes: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  archived: {
    label: 'В архиве',
    classes: 'text-slate-500 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
  deleted: {
    label: 'Удалена',
    classes: 'text-rose-600 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
}

const failed = {
  label: 'Неудача',
  classes: 'text-rose-700 dark:text-rose-400',
  dot: 'bg-rose-500',
}

const cfg = props.status === 'completed' && props.outcome === 'failure'
  ? failed
  : config[props.status]
</script>

<template>
  <span :class="['inline-flex items-center gap-1.5 text-sm font-medium', cfg.classes]">
    <span :class="['w-2 h-2 rounded-full', cfg.dot]" />
    {{ cfg.label }}
  </span>
</template>
