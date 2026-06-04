<template>
  <div class="space-y-3">
    <Calendar
      :model-value="calendarValue"
      :locale="intlLocale"
      :week-starts-on="weekStartsOn"
      weekday-format="short"
      @update:model-value="onCalendarChange"
    />
    <Input
      v-model="localTime"
      type="time"
      class="w-full"
      placeholder="Время (необязательно)"
      @change="onTimeChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { intlLocale, weekStartsOn } from '@/composables/useLocale'
import { toDate, toCalendarDateValue, updateDeadlineTime } from '../lib/dateTime'

const props = defineProps<{
  modelValue: Date | undefined
  time: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Date | undefined): void
  (e: 'update:time', value: string): void
}>()

const localTime = ref(props.time)

const calendarValue = computed(() => toCalendarDateValue(props.modelValue))

function onCalendarChange(val: any) {
  const date = toDate(val)
  if (date && localTime.value) {
    emit('update:modelValue', updateDeadlineTime(date, localTime.value))
  } else {
    emit('update:modelValue', date)
  }
}

function onTimeChange() {
  emit('update:time', localTime.value)
  if (props.modelValue && localTime.value) {
    emit('update:modelValue', updateDeadlineTime(props.modelValue, localTime.value))
  }
}
</script>
