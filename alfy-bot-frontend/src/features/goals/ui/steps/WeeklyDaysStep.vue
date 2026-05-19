<script setup lang="ts">
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'

const props = defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'toggleWeekday', d: number): void
  (e: 'confirmWeekly'): void
  (e: 'back'): void
}>()

// Index 0..6 = Пн..Вс (как в бэке `weekly_days` / в JS getDay() — другая
// схема: 0=Вс. Тут используем тот же индекс, что хранит composable; зеркало
// бота с порядком Пн-первым).
const WEEKDAYS: { idx: number; label: string }[] = [
  { idx: 1, label: 'Пн' },
  { idx: 2, label: 'Вт' },
  { idx: 3, label: 'Ср' },
  { idx: 4, label: 'Чт' },
  { idx: 5, label: 'Пт' },
  { idx: 6, label: 'Сб' },
  { idx: 0, label: 'Вс' },
]

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
        ⬅️ Назад
      </Button>
      <Button :disabled="!canConfirm" @click="emit('confirmWeekly')">
        Готово
      </Button>
    </div>
  </div>
</template>
