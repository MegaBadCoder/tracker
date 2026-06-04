<template>
  <div class="space-y-3">
    <Calendar
      :model-value="calendarValue"
      :locale="intlLocale"
      :week-starts-on="weekStartsOn"
      weekday-format="short"
      @update:model-value="onDateChange"
    />
    <Input
      v-model="deadlineTime"
      type="time"
      class="w-full"
      @change="onTimeChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { intlLocale, weekStartsOn } from '@/composables/useLocale'
import { toDate, toCalendarDateValue, getTimeString, updateDeadlineTime } from '../lib/dateTime'

const props = defineProps<{
  modelValue: Date | undefined
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Date | undefined): void
}>()

const deadlineTime = ref(props.modelValue ? getTimeString(props.modelValue) : '')

const calendarValue = computed(() => toCalendarDateValue(props.modelValue))

function onDateChange(val: any) {
  const newDate = toDate(val)
  if (newDate && deadlineTime.value) {
    emit('update:modelValue', updateDeadlineTime(newDate, deadlineTime.value))
  } else {
    emit('update:modelValue', newDate)
  }
}

function onTimeChange() {
  if (props.modelValue) {
    emit('update:modelValue', updateDeadlineTime(props.modelValue, deadlineTime.value))
  }
}
</script>
