<template>
  <div :style="{ width: trackWidth + 56 + 'px', height: '1440px' }" class="relative flex">
    <!-- Time gutter: sticky left -->
    <div class="w-14 shrink-0 sticky left-0 z-20 bg-card border-r border-border/40 relative">
      <div
        v-for="hour in 24"
        :key="hour"
        class="h-[60px] flex items-start justify-end pr-2 -translate-y-2 text-[10px] text-muted-foreground tabular-nums"
      >
        <template v-if="hour > 1">{{ String(hour - 1).padStart(2, '0') }}:00</template>
      </div>
      <!-- Current time indicator on gutter -->
      <div
        v-if="currentTimeTop !== null"
        class="absolute right-0 z-30 pointer-events-none flex items-center -translate-y-1/2"
        :style="{ top: `${currentTimeTop}px` }"
      >
        <span class="text-[9px] font-medium text-red-500 tabular-nums pr-0.5 bg-white dark:bg-white rounded-full px-1">{{ currentTimeLabel }}</span>
        <div class="w-2 h-2 rounded-full bg-red-500 translate-x-1/2" />
      </div>
    </div>

    <!-- Track -->
    <div
      ref="trackRef"
      class="relative"
      :style="{ width: trackWidth + 'px', height: '1440px' }"
      style="touch-action: none"
      @pointerdown="onCreatePointerDown"
    >
      <!-- Hour lines -->
      <div class="absolute inset-0 pointer-events-none">
        <div
          v-for="hour in 24"
          :key="hour"
          class="absolute left-0 right-0 border-t border-border/30"
          :style="{ top: `${(hour - 1) * 60}px` }"
        />
      </div>

      <!-- Current time line (full track width, thin) -->
      <div
        v-if="currentTimeTop !== null"
        class="absolute left-0 right-0 z-10 pointer-events-none"
        :style="{ top: `${currentTimeTop}px` }"
      >
        <div class="h-px bg-red-500/40" />
      </div>
      <!-- Current time line (today column, thick) -->
      <div
        v-if="currentTimeTop !== null && todayLeft !== null"
        class="absolute z-10 pointer-events-none"
        :style="{ top: `${currentTimeTop}px`, left: todayLeft + 'px', width: dayWidth + 'px' }"
      >
        <div class="h-0.5 bg-red-500" />
      </div>

      <!-- Day columns (absolutely positioned) -->
      <DayColumn
        v-for="day in visibleDays"
        :key="day.toISOString()"
        :day="day"
        :events="getTimedEventsForDay(day)"
        :grid-element="gridRef ?? undefined"
        :dragged-task-id="showOverlay ? draggedTaskId : null"
        :style="{ position: 'absolute', top: '0', left: dayOffset(day) + 'px', width: dayWidth + 'px', height: '1440px' }"
        @drop="payload => $emit('drop', payload)"
        @grab="onGrab"
        @resize-start="onResizeStart"
        @toggle="(taskId) => $emit('toggle', taskId)"
      />

      <!-- Drag overlay ghost -->
      <div
        v-if="showOverlay && draggedEvent"
        :style="[overlayStyle, { height: overlayHeight + 'px' }]"
        :class="[
          'rounded-md px-2 py-1 text-xs overflow-hidden border pointer-events-none opacity-90 z-50 cursor-grabbing',
          ghostClasses,
        ]"
      >
        <div class="font-medium truncate">{{ draggedEvent.title }}</div>
        <div class="text-[10px] opacity-70">{{ overlayTimeLabel }}</div>
      </div>

      <!-- Create slot overlay ghost -->
      <div
        v-if="showCreateOverlay"
        :style="[createOverlayStyle, { height: createOverlayHeight + 'px' }]"
        class="rounded-md px-2 py-1 text-xs overflow-hidden border border-primary/40 bg-primary/15 text-primary pointer-events-none opacity-90 z-50 cursor-grabbing"
      >
        <div class="font-medium truncate">Новая задача</div>
        <div class="text-[10px] opacity-70">{{ createOverlayTimeLabel }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { isSameDay } from 'date-fns'
import type { CalendarEvent, CalendarDropPayload } from '../model/types'
import { isToday } from '../lib/week'
import { getPriorityEventClasses } from '../lib/calendar-styles'
import { useCreateSlotDrag } from '../lib/use-create-slot-drag'
import { usePointerDnd } from '../lib/use-pointer-dnd'
import DayColumn from './DayColumn.vue'

const props = defineProps<{
  visibleDays: Date[]
  dayOffset: (date: Date) => number
  dateFromX: (x: number) => Date
  dayWidth: number
  trackWidth: number
  events: CalendarEvent[]
  gridRef: HTMLElement | null
  onTaskMoved: (taskId: string, newDate: Date, startMinutes: number) => Promise<void>
  onTaskResized: (taskId: string, durationMinutes: number) => Promise<void>
  onSlotCreate: (date: Date, startMinutes: number, durationMinutes: number) => Promise<void>
}>()

const emit = defineEmits<{
  drop: [payload: CalendarDropPayload]
  open: [event: CalendarEvent]
  toggle: [taskId: string]
}>()

const trackRef = ref<HTMLElement | null>(null)

const { showOverlay, draggedTaskId, draggedEvent, overlayStyle, overlayHeight, overlayTimeLabel, onGrab, onResizeStart } = usePointerDnd({
  trackEl: trackRef,
  dayOffset: (d: Date) => props.dayOffset(d),
  dateFromX: (x: number) => props.dateFromX(x),
  dayWidth: props.dayWidth,
  onMoved: (taskId, newDate, startMinutes) => props.onTaskMoved(taskId, newDate, startMinutes),
  onClicked: (event) => emit('open', event),
  onResized: (taskId, durationMinutes) => props.onTaskResized(taskId, durationMinutes),
})

const {
  showOverlay: showCreateOverlay,
  overlayStyle: createOverlayStyle,
  overlayHeight: createOverlayHeight,
  overlayTimeLabel: createOverlayTimeLabel,
  onPointerDown: onCreatePointerDown,
} = useCreateSlotDrag({
  trackEl: trackRef,
  dayOffset: (d: Date) => props.dayOffset(d),
  dateFromX: (x: number) => props.dateFromX(x),
  dayWidth: props.dayWidth,
  onCreated: (date, startMinutes, durationMinutes) => props.onSlotCreate(date, startMinutes, durationMinutes),
})

const ghostClasses = computed(() => {
  if (!draggedEvent.value) return ''
  return draggedEvent.value.completed
    ? 'bg-muted border-border'
    : getPriorityEventClasses(draggedEvent.value.priority)
})

const now = ref(new Date())
let interval: ReturnType<typeof setInterval> | null = null

const currentTimeTop = computed(() => {
  const hours = now.value.getHours()
  const minutes = now.value.getMinutes()
  return hours * 60 + minutes
})

const todayLeft = computed<number | null>(() => {
  const today = props.visibleDays.find(d => isToday(d))
  if (!today) return null
  return props.dayOffset(today)
})

const currentTimeLabel = computed(() => {
  const h = String(now.value.getHours()).padStart(2, '0')
  const m = String(now.value.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
})

function getTimedEventsForDay(day: Date): CalendarEvent[] {
  return props.events.filter(e => !e.isAllDay && isSameDay(e.date, day))
}

onMounted(() => {
  interval = setInterval(() => {
    now.value = new Date()
  }, 60_000)
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})
</script>
