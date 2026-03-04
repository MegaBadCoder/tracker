<script setup lang="ts">
import { ref, watch } from 'vue'
import { CalendarDays, Check, Loader2, Pencil } from 'lucide-vue-next'
import { updateQuestionSchedule, type UpdateScheduleDto } from '../api/goals'
import type { FrequencyType, Schedule } from '../types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const props = defineProps<{
  questionId: number
  schedule: Schedule
}>()

const emit = defineEmits<{
  updated: [schedule: Schedule]
}>()

const editing = ref(false)
const saving = ref(false)
const error = ref('')

const selectedType = ref<FrequencyType>(props.schedule.frequency_type)
const selectedDays = ref<number[]>(parseDays(props.schedule.days_of_week))
const intervalDays = ref<number>(props.schedule.interval_days ?? 2)

watch(() => props.schedule, (s) => {
  selectedType.value = s.frequency_type
  selectedDays.value = parseDays(s.days_of_week)
  intervalDays.value = s.interval_days ?? 2
})

const dayLabels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
// Порядок кнопок: Пн–Вс (Россия)
const dayOrder = [1, 2, 3, 4, 5, 6, 0]

function parseDays(val: number[] | string | null | undefined): number[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  const str = String(val).trim()
  if (str.startsWith('[')) {
    try { return JSON.parse(str) } catch { return [] }
  }
  return str.split(',').map(Number).filter(n => !Number.isNaN(n))
}

function toggleDay(day: number) {
  const idx = selectedDays.value.indexOf(day)
  if (idx >= 0) {
    selectedDays.value.splice(idx, 1)
  } else {
    selectedDays.value.push(day)
    selectedDays.value.sort((a, b) => a - b)
  }
}

function scheduleLabel(s: Schedule): string {
  if (s.frequency_type === 'daily') return 'Каждый день'
  if (s.frequency_type === 'interval') return `Каждые ${s.interval_days} дн.`
  if (s.frequency_type === 'weekly_days' && s.days_of_week) {
    const days = parseDays(s.days_of_week)
    return dayOrder.filter(d => days.includes(d)).map(d => dayLabels[d]).join(', ')
  }
  return 'Не задано'
}

async function save() {
  error.value = ''

  const dto: UpdateScheduleDto = { frequency_type: selectedType.value }

  if (selectedType.value === 'weekly_days') {
    if (selectedDays.value.length === 0) {
      error.value = 'Выберите хотя бы один день'
      return
    }
    dto.days_of_week = selectedDays.value
  }

  if (selectedType.value === 'interval') {
    if (!intervalDays.value || intervalDays.value < 1) {
      error.value = 'Интервал должен быть не менее 1 дня'
      return
    }
    dto.interval_days = intervalDays.value
  }

  saving.value = true
  try {
    const updated = await updateQuestionSchedule(props.questionId, dto)
    emit('updated', updated)
    editing.value = false
  } catch {
    error.value = 'Не удалось сохранить'
  } finally {
    saving.value = false
  }
}

function cancel() {
  selectedType.value = props.schedule.frequency_type
  selectedDays.value = parseDays(props.schedule.days_of_week)
  intervalDays.value = props.schedule.interval_days ?? 2
  error.value = ''
  editing.value = false
}
</script>

<template>
  <section class="bg-card border border-border rounded-xl p-5">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2 text-sm font-semibold text-foreground">
        <CalendarDays class="w-4 h-4 text-muted-foreground" />
        Расписание
      </div>
      <Button
        v-if="!editing"
        variant="ghost"
        size="icon"
        class="h-8 w-8"
        @click="editing = true"
      >
        <Pencil class="w-4 h-4 text-muted-foreground" />
      </Button>
    </div>

    <!-- Display -->
    <div v-if="!editing" class="text-sm text-muted-foreground">
      {{ scheduleLabel(schedule) }}
    </div>

    <!-- Edit -->
    <div v-else class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="opt in ([
            { value: 'daily', label: 'Каждый день' },
            { value: 'weekly_days', label: 'Дни недели' },
            { value: 'interval', label: 'Интервал' },
          ] as { value: FrequencyType, label: string }[])"
          :key="opt.value"
          :variant="selectedType === opt.value ? 'default' : 'secondary'"
          size="sm"
          @click="selectedType = opt.value"
        >
          {{ opt.label }}
        </Button>
      </div>

      <div v-if="selectedType === 'weekly_days'" class="flex flex-wrap gap-2">
        <Button
          v-for="day in dayOrder"
          :key="day"
          :variant="selectedDays.includes(day) ? 'default' : 'secondary'"
          size="icon"
          class="w-10 h-10"
          @click="toggleDay(day)"
        >
          {{ dayLabels[day] }}
        </Button>
      </div>

      <div v-if="selectedType === 'interval'" class="flex items-center gap-3">
        <label class="text-sm text-muted-foreground">Каждые</label>
        <Input
          v-model.number="intervalDays"
          type="number"
          min="1"
          max="365"
          class="w-20"
        />
        <span class="text-sm text-muted-foreground">дн.</span>
      </div>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

      <div class="flex items-center gap-2 pt-1">
        <Button
          :disabled="saving"
          size="sm"
          @click="save"
        >
          <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
          <Check v-else class="w-4 h-4" />
          Сохранить
        </Button>
        <Button
          variant="ghost"
          size="sm"
          :disabled="saving"
          @click="cancel"
        >
          Отмена
        </Button>
      </div>
    </div>
  </section>
</template>
