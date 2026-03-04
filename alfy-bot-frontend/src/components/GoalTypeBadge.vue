<script setup lang="ts">
import type { GoalType } from '../types'

const props = defineProps<{ type: GoalType }>()

const config: Record<GoalType, { label: string, classes: string }> = {
  SIMPLE: { label: 'Simple', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  SMART: { label: 'Smart', classes: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  GLOBAL: { label: 'Global', classes: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
}

const cfg = config[props.type]!
</script>

<template>
  <span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tracking-wide uppercase', cfg.classes]">
    {{ cfg.label }}
  </span>
</template>
