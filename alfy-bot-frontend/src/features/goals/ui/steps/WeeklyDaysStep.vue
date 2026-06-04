<script setup lang="ts">
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import { ArrowLeft } from 'lucide-vue-next'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { WEEKDAYS } from './goal-create-options'

const props = defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'toggleWeekday', d: number): void
  (e: 'confirmWeekly'): void
  (e: 'back'): void
}>()

const selected = computed(() => props.state.pending.selectedDays ?? [])

function isActive(idx: number) {
  return selected.value.includes(idx)
}

const canConfirm = computed(() => selected.value.length >= 1)
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      Выбери дни отчёта (нажми чтобы отметить):
    </h2>

    <div class="flex flex-wrap gap-2">
      <Button
        v-for="d in WEEKDAYS"
        :key="d.idx"
        :variant="isActive(d.idx) ? 'default' : 'outline'"
        size="sm"
        @click="emit('toggleWeekday', d.idx)"
      >
        {{ d.label }}
      </Button>
    </div>

    <p v-if="!canConfirm" class="text-sm text-muted-foreground">
      Выбери хотя бы один день
    </p>

    <div class="flex gap-2">
      <Button variant="outline" @click="emit('back')">
        <ArrowLeft class="size-4" />
        Назад
      </Button>
      <Button :disabled="!canConfirm" @click="emit('confirmWeekly')">
        Готово
      </Button>
    </div>
  </div>
</template>
