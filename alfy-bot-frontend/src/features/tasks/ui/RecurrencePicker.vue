<template>
  <DropdownMenuContent>
    <RecurrencePickerContent
      :model-value="modelValue"
      :on-missed="onMissed"
      @update:model-value="$emit('update:modelValue', $event)"
      @update:on-missed="$emit('update:onMissed', $event)"
    />
  </DropdownMenuContent>
</template>

<script setup lang="ts">
import { DropdownMenuContent } from '@/components/ui/dropdown-menu'
import type { RecurrenceRule } from '../model/recurrence'
import RecurrencePickerContent from './RecurrencePickerContent.vue'

defineProps<{
  modelValue: RecurrenceRule | null | undefined
  onMissed?: 'shift' | 'freeze'
}>()

defineEmits<{
  (e: 'update:modelValue', value: RecurrenceRule | null): void
  (e: 'update:onMissed', value: 'shift' | 'freeze'): void
}>()
</script>
