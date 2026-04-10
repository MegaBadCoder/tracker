<template>
  <DropdownMenuContent class="w-56" align="start">
    <RecurrencePickerContent
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </DropdownMenuContent>
</template>

<script setup lang="ts">
import { DropdownMenuContent } from '@/components/ui/dropdown-menu'
import type { RecurrenceRule } from '../model/recurrence'
import RecurrencePickerContent from './RecurrencePickerContent.vue'

defineProps<{
  modelValue: RecurrenceRule | null | undefined
}>()

defineEmits<{
  (e: 'update:modelValue', value: RecurrenceRule | null): void
}>()
</script>
