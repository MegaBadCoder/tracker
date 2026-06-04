<script setup lang="ts">
import type { FlowState, GoalTypeKey } from '@/features/goals/model/use-goal-create-flow'
import { Button } from '@/components/ui/button'
import { GOAL_TYPE_OPTIONS } from './goal-types'

defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'selectType', t: GoalTypeKey): void
}>()
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      Какую цель хочешь поставить?
    </h2>

    <div class="flex flex-col gap-2">
      <Button
        v-for="opt in GOAL_TYPE_OPTIONS"
        :key="opt.type"
        variant="outline"
        size="lg"
        class="justify-start"
        @click="emit('selectType', opt.type)"
      >
        {{ opt.label }}
      </Button>
    </div>
  </div>
</template>
