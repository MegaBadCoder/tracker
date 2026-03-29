<template>
  <div
    :class="[
      'relative border-r border-border/40',
      isDragOver && 'bg-primary/5',
    ]"
    @dragover.prevent="isDragOver = true"
    @dragleave="isDragOver = false"
    @drop="onDrop"
  >
    <CalendarEventBlock
      v-for="event in events"
      :key="event.taskId"
      :event="event"
      :hidden="event.taskId === draggedTaskId"
      @grab="(ev, pe) => $emit('grab', ev, pe)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { CalendarEvent, CalendarDropPayload } from '../model/types'
import CalendarEventBlock from './CalendarEventBlock.vue'

const props = defineProps<{
  day: Date
  events: CalendarEvent[]
  gridElement?: HTMLElement
  draggedTaskId?: string | null
}>()

const emit = defineEmits<{
  drop: [payload: CalendarDropPayload]
  grab: [event: CalendarEvent, pointerEvent: PointerEvent]
}>()

const isDragOver = ref(false)

function onDrop(e: DragEvent) {
  isDragOver.value = false
  const taskId = e.dataTransfer?.getData('text/plain')
  if (!taskId) return

  if (!props.gridElement) {
    emit('drop', { taskId, newDate: props.day })
    return
  }

  const rect = props.gridElement.getBoundingClientRect()
  const y = e.clientY - rect.top + props.gridElement.scrollTop
  const totalHeight = 60 * 24
  const rawMinutes = Math.round((y / totalHeight) * 24 * 60)
  const startMinutes = Math.max(0, Math.min(Math.round(rawMinutes / 5) * 5, 23 * 60 + 55))

  emit('drop', { taskId, newDate: props.day, startMinutes })
}
</script>
