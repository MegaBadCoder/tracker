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
            'text-[10px] px-1.5 py-0.5 rounded max-w-full border flex items-center gap-0.5',
            event.task.isOverdue
              ? 'cursor-not-allowed'
              : event.isVirtual
                ? 'cursor-default'
                : 'cursor-grab',
            event.task.isOverdue
              ? OVERDUE_EVENT_CLASSES
              : event.completed
                ? 'bg-muted border-border line-through'
                : event.isVirtual
                  ? 'border-dashed border-border/60 bg-muted'
                  : chipClasses(event),
            highlightedTaskId === event.taskId && 'ring-2 ring-primary',
          ]"
          :draggable="!event.isVirtual && !event.task.isOverdue"
          @dragstart="onDragStart($event, event)"
          @click.stop="$emit('open', event)"
        >
          <span class="truncate">{{ event.title }}</span>
          <button
            v-if="event.isVirtual"
            type="button"
            data-testid="materialize-occurrence"
            class="shrink-0 rounded p-0.5 hover:bg-foreground/10"
            aria-label="Проявить задачу"
            @pointerdown.stop
            @click.stop="$emit('materialize', event)"
          >
            <CalendarPlus :size="10" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CalendarPlus } from 'lucide-vue-next'
import { isSameDay } from 'date-fns'
import type { CalendarEvent, CalendarDropPayload } from '../model/types'
import { getPriorityEventClasses, OVERDUE_EVENT_CLASSES } from '../lib/calendar-styles'
import { highlightedTaskId } from '@/features/tasks/lib/use-recurring-reschedule'

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
  materialize: [event: CalendarEvent]
}>()

const dragOverDay = ref<string | null>(null)

function getEventsForDay(day: Date): CalendarEvent[] {
  return props.events.filter(e => e.isAllDay && isSameDay(e.date, day))
}

function chipClasses(event: CalendarEvent): string {
  return getPriorityEventClasses(event.priority)
}

function onDragStart(e: DragEvent, event: CalendarEvent) {
  if (event.isVirtual || event.task.isOverdue) {
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
