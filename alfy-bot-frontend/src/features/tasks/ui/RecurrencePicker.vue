<template>
  <DropdownMenuContent class="w-56" align="start">
    <DropdownMenuItem
      v-for="preset in PRESETS"
      :key="preset.label"
      class="cursor-pointer gap-2"
      @click="selectPreset(preset.value)"
    >
      <Repeat :size="14" class="text-muted-foreground" />
      {{ preset.label }}
    </DropdownMenuItem>

    <DropdownMenuSeparator />

    <DropdownMenuItem
      class="cursor-pointer gap-2"
      @click="showCustom = true"
    >
      <Settings2 :size="14" class="text-muted-foreground" />
      Настроить...
    </DropdownMenuItem>

    <DropdownMenuSeparator v-if="modelValue" />

    <DropdownMenuItem
      v-if="modelValue"
      class="cursor-pointer gap-2 text-muted-foreground"
      @click="$emit('update:modelValue', null)"
    >
      <X :size="14" />
      Убрать
    </DropdownMenuItem>

    <!-- Custom config inline -->
    <div v-if="showCustom" class="p-3 space-y-3 border-t border-border/40">
      <div class="space-y-1.5">
        <label class="text-[11px] text-muted-foreground font-medium">Частота</label>
        <div class="flex gap-1.5">
          <button
            v-for="freq in FREQUENCIES"
            :key="freq.value"
            :class="[
              'px-2 py-1 rounded text-[11px] transition-colors',
              customFrequency === freq.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground',
            ]"
            @click="customFrequency = freq.value"
          >
            {{ freq.label }}
          </button>
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-[11px] text-muted-foreground font-medium">Каждые</label>
        <input
          v-model.number="customInterval"
          type="number"
          min="1"
          max="99"
          class="w-full h-8 px-2 rounded border border-border bg-background text-sm"
        />
      </div>

      <div v-if="customFrequency === 'weekly'" class="space-y-1.5">
        <label class="text-[11px] text-muted-foreground font-medium">Дни недели</label>
        <div class="flex gap-1">
          <button
            v-for="day in WEEK_DAYS"
            :key="day.value"
            :class="[
              'w-8 h-8 rounded text-[11px] transition-colors',
              customDaysOfWeek.includes(day.value)
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground',
            ]"
            @click="toggleDay(day.value)"
          >
            {{ day.label }}
          </button>
        </div>
      </div>

      <button
        class="w-full h-8 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        @click="applyCustom"
      >
        Применить
      </button>
    </div>
  </DropdownMenuContent>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Repeat, Settings2, X } from 'lucide-vue-next'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { RecurrenceRule, RecurrenceFrequency } from '../model/recurrence'

defineProps<{
  modelValue: RecurrenceRule | null | undefined
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: RecurrenceRule | null): void
}>()

const showCustom = ref(false)
const customFrequency = ref<RecurrenceFrequency>('daily')
const customInterval = ref(1)
const customDaysOfWeek = ref<number[]>([])

// Display order: Mon-first for RU locale; values are JS day indices (0=Sun..6=Sat)
const WEEK_DAYS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Вс' },
]

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'daily', label: 'День' },
  { value: 'weekly', label: 'Неделя' },
  { value: 'monthly', label: 'Месяц' },
  { value: 'yearly', label: 'Год' },
]

const PRESETS: { label: string; value: RecurrenceRule }[] = [
  { label: 'Каждый день', value: { frequency: 'daily', interval: 1 } },
  { label: 'Каждую неделю', value: { frequency: 'weekly', interval: 1 } },
  { label: 'Каждый месяц', value: { frequency: 'monthly', interval: 1 } },
  { label: 'Каждый год', value: { frequency: 'yearly', interval: 1 } },
]

function selectPreset(rule: RecurrenceRule) {
  emit('update:modelValue', rule)
}

function toggleDay(day: number) {
  const idx = customDaysOfWeek.value.indexOf(day)
  if (idx === -1) {
    customDaysOfWeek.value.push(day)
  } else {
    customDaysOfWeek.value.splice(idx, 1)
  }
}

function applyCustom() {
  const rule: RecurrenceRule = {
    frequency: customFrequency.value,
    interval: Math.max(1, customInterval.value),
  }

  if (customFrequency.value === 'weekly' && customDaysOfWeek.value.length > 0) {
    rule.daysOfWeek = [...customDaysOfWeek.value].sort((a, b) => a - b)
  }

  emit('update:modelValue', rule)
  showCustom.value = false
}
</script>
