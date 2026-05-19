<script setup lang="ts">
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import type { FrequencyType } from '@/types'
import { Button } from '@/components/ui/button'

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
        Каждый день
      </Button>
      <Button
        variant="outline"
        size="lg"
        class="justify-start"
        @click="emit('selectSchedule', 'weekly_days')"
      >
        Определённые дни недели
      </Button>
      <Button
        variant="outline"
        size="lg"
        class="justify-start"
        @click="emit('selectSchedule', 'interval')"
      >
        Через N дней
      </Button>
    </div>

    <div>
      <Button variant="outline" @click="emit('back')">
        ⬅️ Назад
      </Button>
    </div>
  </div>
</template>
