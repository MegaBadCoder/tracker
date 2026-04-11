<template>
  <div class="sticky top-[52px] z-20 bg-card border-b border-border flex min-h-[60px]">
    <!-- Gutter label: sticky left -->
    <div class="w-14 shrink-0 flex items-center justify-center text-[10px] text-muted-foreground border-r border-border/40 sticky left-0 z-30 bg-card">
      Весь день
    </div>
    <div class="relative min-h-[60px]" :style="{ width: trackWidth + 'px' }">
      <div
        v-for="day in visibleDays"
        :key="day.toISOString()"
        :class="[
          'absolute top-0 bottom-0 p-1 flex flex-wrap gap-1 content-start border-r border-border/40',
          dragOverDay === day.toISOString() && 'bg-primary/5',
        ]"
        :style="{ left: dayOffset(day) + 'px', width: dayWidth + 'px' }"
        @dragover.prevent="dragOverDay = day.toISOString()"
        @dragleave="dragOverDay = null"
        @drop="onDrop($event, day)"
      >
        <div
          v-for="event in getEventsForDay(day)"
          :key="event.taskId"
          :class="[
            'text-[10px] px-1.5 py-0.5 rounded truncate max-w-full border',
            event.isVirtual ? 'cursor-default' : 'cursor-grab',
            event.completed
              ? 'bg-muted border-border line-through'
              : event.isVirtual
                ? 'border-dashed border-border/60 bg-muted'
                : chipClasses(event),
          ]"
          :draggable="!event.isVirtual"
          @dragstart="onDragStart($event, event)"
          @click.stop="$emit('open', event)"
        >
          {{ event.title }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { isSameDay } from 'date-fns'
import type { CalendarEvent, CalendarDropPayload } from '../model/types'
import { getPriorityEventClasses } from '../lib/calendar-styles'

const props = defineProps<{
  visibleDays: Date[]
  dayOffset: (date: Date) => number
  dayWidth: number
  trackWidth: number
  events: CalendarEvent[]
}>()

const emit = defineEmits<{
  drop: [payload: CalendarDropPayload]
  dragstart: [event: DragEvent, taskId: string]
  open: [event: CalendarEvent]
}>()

const dragOverDay = ref<string | null>(null)

function getEventsForDay(day: Date): CalendarEvent[] {
  return props.events.filter(e => e.isAllDay && isSameDay(e.date, day))
}

function chipClasses(event: CalendarEvent): string {
  return getPriorityEventClasses(event.priority)
}

function onDragStart(e: DragEvent, event: CalendarEvent) {
  if (event.isVirtual) {
    e.preventDefault()
    return
  }
  emit('dragstart', e, event.taskId)
}

function onDrop(e: DragEvent, day: Date) {
  dragOverDay.value = null
  const taskId = e.dataTransfer?.getData('text/plain')
  if (!taskId) return
  const event = props.events.find(ev => ev.taskId === taskId)
  emit('drop', { taskId, newDate: day, isVirtual: event?.isVirtual ?? false })
}
</script>
