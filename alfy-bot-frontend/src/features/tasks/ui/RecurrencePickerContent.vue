<template>
  <div class="space-y-1">
    <button
      v-for="preset in PRESETS"
      :key="preset.label"
      class="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-sm hover:bg-muted/60 transition-colors cursor-pointer"
      @click="$emit('update:modelValue', preset.value)"
    >
      <Repeat :size="14" class="text-muted-foreground" />
      {{ preset.label }}
    </button>

    <div class="h-px bg-border/40 my-1" />

    <button
      class="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-sm hover:bg-muted/60 transition-colors cursor-pointer"
      @click="showCustom = true"
    >
      <Settings2 :size="14" class="text-muted-foreground" />
      Настроить...
    </button>

    <template v-if="modelValue">
      <div class="h-px bg-border/40 my-1" />
      <button
        class="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:bg-muted/60 transition-colors cursor-pointer"
        @click="$emit('update:modelValue', null)"
      >
        <X :size="14" />
        Убрать
      </button>
    </template>

    <template v-if="modelValue">
      <div class="h-px bg-border/40 my-1" />
      <div class="px-3 py-2 space-y-1.5">
        <label class="text-[11px] text-muted-foreground font-medium">Если пропущено</label>
        <button
          :class="[
            'flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm transition-colors',
            (onMissed ?? 'shift') === 'shift'
              ? 'bg-primary/15 text-foreground'
              : 'hover:bg-muted/60 text-muted-foreground',
          ]"
          @click="$emit('update:onMissed', 'shift')"
        >
          На будущий день или сегодня
        </button>
        <button
          :class="[
            'flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm transition-colors',
            onMissed === 'freeze'
              ? 'bg-primary/15 text-foreground'
              : 'hover:bg-muted/60 text-muted-foreground',
          ]"
          @click="$emit('update:onMissed', 'freeze')"
        >
          Подсвечивать пропущенные
        </button>
      </div>
    </template>

    <div v-if="showCustom" class="p-3 space-y-3 border-t border-border/40 mt-1">
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Repeat, Settings2, X } from 'lucide-vue-next'
import type { RecurrenceRule, RecurrenceFrequency } from '../model/recurrence'

defineProps<{
  modelValue: RecurrenceRule | null | undefined
  onMissed?: 'shift' | 'freeze'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: RecurrenceRule | null): void
  (e: 'update:onMissed', value: 'shift' | 'freeze'): void
}>()

const showCustom = ref(false)
const customFrequency = ref<RecurrenceFrequency>('daily')
const customInterval = ref(1)
const customDaysOfWeek = ref<number[]>([])

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
