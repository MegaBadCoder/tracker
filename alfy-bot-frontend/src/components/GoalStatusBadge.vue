<script setup lang="ts">
import type { GoalStatus } from '../types'

const props = defineProps<{ status: GoalStatus }>()

const config: Record<GoalStatus, { label: string, classes: string, dot: string }> = {
  active: {
    label: 'Активна',
    classes: 'text-green-700 dark:text-green-400',
    dot: 'bg-green-500',
  },
  completed: {
    label: 'Завершена',
    classes: 'text-gray-500 dark:text-gray-400',
    dot: 'bg-gray-400',
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

const cfg = config[props.status]
</script>

<template>
  <span :class="['inline-flex items-center gap-1.5 text-sm font-medium', cfg.classes]">
    <span :class="['w-2 h-2 rounded-full', cfg.dot]" />
    {{ cfg.label }}
  </span>
</template>
