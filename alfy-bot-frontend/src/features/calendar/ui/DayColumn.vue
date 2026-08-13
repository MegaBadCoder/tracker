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
      :layout="columns.get(event.taskId)"
      :hidden="event.taskId === draggedTaskId"
      @grab="(ev, pe) => $emit('grab', ev, pe)"
      @resize-start="(ev, pe) => $emit('resize-start', ev, pe)"
      @toggle="(taskId) => $emit('toggle', taskId)"
      @materialize="(event) => $emit('materialize', event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CalendarEvent, CalendarDropPayload } from '../model/types'
import { assignEventColumns } from '../lib/layout-overlapping'
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
  'resize-start': [event: CalendarEvent, pointerEvent: PointerEvent]
  toggle: [taskId: string]
  materialize: [event: CalendarEvent]
}>()

const isDragOver = ref(false)
const columns = computed(() => assignEventColumns(props.events))

function onDrop(e: DragEvent) {
  isDragOver.value = false
  const taskId = e.dataTransfer?.getData('text/plain')
  if (!taskId) return

  const isVirtual = taskId.includes('__virtual__')

  if (!props.gridElement) {
    emit('drop', { taskId, newDate: props.day, isVirtual })
    return
  }

  const rect = props.gridElement.getBoundingClientRect()
  const y = e.clientY - rect.top + props.gridElement.scrollTop
  const totalHeight = 60 * 24
  const rawMinutes = Math.round((y / totalHeight) * 24 * 60)
  const startMinutes = Math.max(0, Math.min(Math.round(rawMinutes / 5) * 5, 23 * 60 + 55))

  emit('drop', { taskId, newDate: props.day, startMinutes, isVirtual })
}
</script>
