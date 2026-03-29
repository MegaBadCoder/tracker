<template>
  <div
    :class="[
      'absolute left-0.5 right-0.5 rounded-md px-2 py-1 text-xs overflow-hidden border',
      hidden ? 'invisible' : 'cursor-grab',
      completed
        ? 'opacity-50 bg-muted border-border'
        : priorityClasses,
    ]"
    :style="blockStyle"
    style="touch-action: none"
    @pointerdown="onPointerDown"
  >
    <div :class="['font-medium truncate', completed && 'line-through']">
      {{ event.title }}
    </div>
    <div class="text-[10px] opacity-70">
      {{ timeLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CalendarEvent } from '../model/types'
import { getPriorityEventClasses } from '../lib/calendar-styles'

const HOUR_HEIGHT = 60
const TOTAL_MINUTES = 24 * 60

const props = defineProps<{
  event: CalendarEvent
  hidden?: boolean
}>()

const emit = defineEmits<{
  grab: [event: CalendarEvent, pointerEvent: PointerEvent]
}>()

const completed = computed(() => props.event.completed)
const priorityClasses = computed(() => getPriorityEventClasses(props.event.priority))

const blockStyle = computed(() => {
  const top = (props.event.startMinutes / TOTAL_MINUTES) * HOUR_HEIGHT * 24
  const height = Math.max((props.event.durationMinutes / TOTAL_MINUTES) * HOUR_HEIGHT * 24, 20)
  return {
    top: `${top}px`,
    height: `${height}px`,
  }
})

const timeLabel = computed(() => {
  const start = props.event.startMinutes
  const end = start + props.event.durationMinutes
  return `${formatMinutes(start)}–${formatMinutes(end)}`
})

function formatMinutes(m: number): string {
  const hours = Math.floor(m / 60) % 24
  const mins = m % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  emit('grab', props.event, e)
}
</script>
