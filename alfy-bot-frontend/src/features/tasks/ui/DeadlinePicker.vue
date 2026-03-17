<template>
  <DropdownMenuContent class="w-auto p-0" align="start">
    <div class="p-3 space-y-3">
      <Calendar :model-value="modelValue as any" @update:model-value="onDateChange" />
      <Input
        v-model="deadlineTime"
        type="time"
        class="w-full"
        @change="onTimeChange"
      />
    </div>
  </DropdownMenuContent>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { DropdownMenuContent } from '@/components/ui/dropdown-menu'
import { getTimeString, updateDeadlineTime } from '../lib/dateTime'

const props = defineProps<{
  modelValue: Date | undefined
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Date | undefined): void
}>()

const deadlineTime = ref('')

watch(() => props.modelValue, (val) => {
  deadlineTime.value = val ? getTimeString(val) : ''
}, { immediate: true })

function onDateChange(val: any) {
  const newDate = val as Date | undefined
  if (newDate && deadlineTime.value) {
    emit('update:modelValue', updateDeadlineTime(newDate, deadlineTime.value))
  } else {
    emit('update:modelValue', newDate)
  }
}

function onTimeChange() {
  emit('update:modelValue', updateDeadlineTime(props.modelValue, deadlineTime.value))
}
</script>
