<template>
  <DropdownMenuContent class="w-44" align="start">
    <PriorityPickerContent
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </DropdownMenuContent>
</template>

<script setup lang="ts">
import { DropdownMenuContent } from '@/components/ui/dropdown-menu'
import type { Priority } from '../model/types'
import PriorityPickerContent from './PriorityPickerContent.vue'

defineProps<{
  modelValue: Priority | undefined
}>()

defineEmits<{
  (e: 'update:modelValue', value: Priority | undefined): void
}>()
</script>
