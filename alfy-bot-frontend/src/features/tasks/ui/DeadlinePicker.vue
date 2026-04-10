<template>
  <DropdownMenuContent class="w-auto p-0" align="start">
    <div class="p-3">
      <DeadlinePickerContent
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
      />
    </div>
  </DropdownMenuContent>
</template>

<script setup lang="ts">
import { DropdownMenuContent } from '@/components/ui/dropdown-menu'
import DeadlinePickerContent from './DeadlinePickerContent.vue'

defineProps<{
  modelValue: Date | undefined
}>()

defineEmits<{
  (e: 'update:modelValue', value: Date | undefined): void
}>()
</script>
