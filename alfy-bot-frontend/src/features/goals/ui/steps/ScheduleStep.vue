<script setup lang="ts">
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import type { FrequencyType } from '@/types'
import { ArrowLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { SCHEDULE_LABELS } from './goal-create-options'

defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'selectSchedule', t: FrequencyType): void
  (e: 'back'): void
}>()
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      Как часто хочешь отчитываться?
    </h2>

    <div class="flex flex-col gap-2">
      <Button
        variant="outline"
        size="lg"
        class="justify-start"
        @click="emit('selectSchedule', 'daily')"
      >
        {{ SCHEDULE_LABELS.daily }}
      </Button>
      <Button
        variant="outline"
        size="lg"
        class="justify-start"
        @click="emit('selectSchedule', 'weekly_days')"
      >
        {{ SCHEDULE_LABELS.weekly_days }}
      </Button>
      <Button
        variant="outline"
        size="lg"
        class="justify-start"
        @click="emit('selectSchedule', 'interval')"
      >
        {{ SCHEDULE_LABELS.interval }}
      </Button>
    </div>

    <div>
      <Button variant="outline" @click="emit('back')">
        <ArrowLeft class="size-4" />
        Назад
      </Button>
    </div>
  </div>
</template>
