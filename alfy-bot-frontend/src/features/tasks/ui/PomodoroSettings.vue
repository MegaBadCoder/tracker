<template>
  <div class="grid grid-cols-5 gap-2">
    <div class="space-y-1">
      <label class="text-[11px] text-muted-foreground/70 leading-none">Раунды</label>
      <Input
        :model-value="count"
        type="number"
        :min="1"
        :max="10"
        :disabled="!editable"
        class="h-7 text-xs px-2 text-left [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        @update:model-value="$emit('update:count', Number($event))"
        @blur="$emit('blur')"
      />
    </div>
    <div class="space-y-1">
      <label class="text-[11px] text-muted-foreground/70 leading-none">Фокус</label>
      <Input
        :model-value="duration"
        type="number"
        :min="1"
        :max="60"
        :disabled="!editable"
        class="h-7 text-xs px-2 text-left [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        @update:model-value="$emit('update:duration', Number($event))"
        @blur="$emit('blur')"
      />
    </div>
    <div class="space-y-1">
      <label class="text-[11px] text-muted-foreground/70 leading-none">Перерыв</label>
      <Input
        :model-value="shortBreak"
        type="number"
        :min="1"
        :max="15"
        :disabled="!editable"
        class="h-7 text-xs px-2 text-left [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        @update:model-value="$emit('update:shortBreak', Number($event))"
        @blur="$emit('blur')"
      />
    </div>
    <div class="space-y-1">
      <label class="text-[11px] text-muted-foreground/70 leading-none">Долгий</label>
      <Input
        :model-value="longBreak"
        type="number"
        :min="5"
        :max="30"
        :disabled="!editable"
        class="h-7 text-xs px-2 text-left [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        @update:model-value="$emit('update:longBreak', Number($event))"
        @blur="$emit('blur')"
      />
    </div>
    <div class="space-y-1">
      <label class="text-[11px] text-muted-foreground/70 leading-none">Интервал</label>
      <Input
        :model-value="longBreakInterval"
        type="number"
        :min="2"
        :max="10"
        :disabled="!editable"
        class="h-7 text-xs px-2 text-left [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        @update:model-value="$emit('update:longBreakInterval', Number($event))"
        @blur="$emit('blur')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { POMODORO_DEFAULTS } from '../model/constants'

withDefaults(defineProps<{
  count?: number
  duration?: number
  shortBreak?: number
  longBreak?: number
  longBreakInterval?: number
  editable?: boolean
}>(), {
  count: POMODORO_DEFAULTS.count,
  duration: POMODORO_DEFAULTS.duration,
  shortBreak: POMODORO_DEFAULTS.shortBreak,
  longBreak: POMODORO_DEFAULTS.longBreak,
  longBreakInterval: POMODORO_DEFAULTS.longBreakInterval,
  editable: true,
})

defineEmits<{
  (e: 'update:count', value: number): void
  (e: 'update:duration', value: number): void
  (e: 'update:shortBreak', value: number): void
  (e: 'update:longBreak', value: number): void
  (e: 'update:longBreakInterval', value: number): void
  (e: 'blur'): void
}>()
</script>
