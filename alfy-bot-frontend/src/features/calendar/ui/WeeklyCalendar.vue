<template>
  <div class="flex flex-col bg-card overflow-hidden">
    <CalendarHeader
      :label="rangeLabel"
      @navigate="onNavigate"
      @today="onToday"
    />

    <!-- Single scroll container for both axes -->
    <div
      ref="gridRef"
      :class="['flex-1 min-h-0 overflow-auto select-none', grabCursor]"
      @scroll="onScroll"
      @mousedown="onGrabMouseDown"
      @mousemove="onGrabMouseMove"
      @mouseup="onGrabMouseUp"
    >
      <div :style="{ width: TRACK_WIDTH + GUTTER_WIDTH + 'px' }" class="relative">

        <!-- Day headers: sticky top -->
        <div class="sticky top-0 z-30 bg-card border-b border-border flex" style="height: 52px">
          <div class="w-14 shrink-0 border-r border-border/40 sticky left-0 z-40 bg-card" />
          <div class="relative" :style="{ width: TRACK_WIDTH + 'px', height: '52px' }">
            <div
              v-for="day in visibleDays"
              :key="'h-' + day.toISOString()"
              :class="[
                'absolute top-0 text-center py-2 border-r border-border/40',
                isToday(day) && 'bg-primary/5',
              ]"
              :style="{ left: dayOffset(day) + 'px', width: DAY_WIDTH + 'px', height: '52px' }"
            >
              <div class="text-[10px] uppercase text-muted-foreground">{{ formatDayHeader(day).dayName }}</div>
              <div
                :class="[
                  'text-sm font-medium',
                  isToday(day) && 'text-primary',
                ]"
              >
                {{ formatDayHeader(day).dayNumber }}
              </div>
            </div>
          </div>
        </div>

        <!-- All-day section: sticky below headers -->
        <AllDaySection
          :visible-days="visibleDays"
          :day-offset="dayOffset"
          :day-width="DAY_WIDTH"
          :track-width="TRACK_WIDTH"
          :events="calendarEvents"
          @drop="onDrop"
          @dragstart="onDragStart"
          @open="onEventOpen"
        />

        <!-- Hour grid -->
        <HourGrid
          :visible-days="visibleDays"
          :day-offset="dayOffset"
          :date-from-x="dateFromX"
          :day-width="DAY_WIDTH"
          :track-width="TRACK_WIDTH"
          :events="calendarEvents"
          :grid-ref="gridRef"
          :on-task-moved="onTaskMoved"
          :on-task-resized="onTaskResized"
          @drop="onDrop"
          @open="onEventOpen"
          @toggle="onToggleTask"
        />

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { tasksToCalendarEvents } from '../lib/calendar-events'
import { isToday, formatDayHeader, formatDateRange, getWeekStart, navigateWeek } from '../lib/week'
import { useCalendarDnd } from '../lib/use-calendar-dnd'
import { useInfiniteDays, DAY_WIDTH, TRACK_WIDTH, GUTTER_WIDTH } from '../lib/use-infinite-days'
import { useGrabScroll } from '../lib/use-grab-scroll'
import type { CalendarEvent, CalendarDropPayload } from '../model/types'
import CalendarHeader from './CalendarHeader.vue'
import AllDaySection from './AllDaySection.vue'
import HourGrid from './HourGrid.vue'

const emit = defineEmits<{
  'open-task': [task: import('@/features/tasks/model/types').Task]
}>()

const taskStore = useTaskStore()
const { startDrag } = useCalendarDnd()

const gridRef = ref<HTMLElement | null>(null)
const { visibleDays, dateRange, dayOffset, dateFromX, scrollToDate, onScroll } = useInfiniteDays(gridRef)
const {
  grabbing, ctrlHeld,
  onMouseDown: onGrabMouseDown,
  onMouseMove: onGrabMouseMove,
  onMouseUp: onGrabMouseUp,
} = useGrabScroll(gridRef)

const grabCursor = computed(() => {
  if (grabbing.value) return 'cursor-grabbing'
  if (ctrlHeld.value) return 'cursor-grab'
  return ''
})

const rangeLabel = computed(() => formatDateRange(dateRange.value.start, dateRange.value.end))

const calendarEvents = computed(() => {
  const days = visibleDays.value
  if (days.length === 0) return []
  const start = days[0]!
  const end = new Date(days[days.length - 1]!)
  end.setHours(23, 59, 59, 999)
  return tasksToCalendarEvents(taskStore.tasks, start, end)
})

function onNavigate(direction: number) {
  const currentWeekStart = getWeekStart(dateRange.value.start)
  scrollToDate(navigateWeek(currentWeekStart, direction), true)
}

function onToday() {
  scrollToDate(new Date(), true)
}

function onDragStart(e: DragEvent, taskId: string) {
  startDrag(e, taskId)
}

async function applyTaskMove(taskId: string, newDate: Date, startMinutes?: number) {
  const date = new Date(newDate)
  if (startMinutes !== undefined) {
    date.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
  } else {
    date.setHours(0, 0, 0, 0)
  }
  try {
    await taskStore.updateTask(taskId, { dueDate: date }, false)
  } catch (err) {
    console.error('Ошибка перемещения задачи:', err)
  }
}

async function onTaskMoved(taskId: string, newDate: Date, startMinutes: number) {
  await applyTaskMove(taskId, newDate, startMinutes)
}

async function onTaskResized(taskId: string, durationMinutes: number) {
  try {
    await taskStore.updateTask(taskId, { durationMinutes }, false)
  } catch (err) {
    console.error('Ошибка изменения длительности:', err)
  }
}

async function onToggleTask(taskId: string) {
  try {
    await taskStore.toggleTask(taskId)
  } catch (err) {
    console.error('Ошибка переключения задачи:', err)
  }
}

function onEventOpen(event: CalendarEvent) {
  if (!event.isVirtual) {
    emit('open-task', event.task)
  }
}

function onDrop(payload: CalendarDropPayload) {
  if (payload.isVirtual) return
  applyTaskMove(payload.taskId, payload.newDate, payload.startMinutes)
}

onMounted(() => {
  if (taskStore.tasks.length === 0) {
    taskStore.fetchTasks()
  }
})
</script>
