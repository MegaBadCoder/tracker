<script setup lang="ts">
import type { CalendarDropPayload, CalendarEvent, CalendarViewMode } from '../model/types'
import { useElementSize } from '@vueuse/core'
import { addDays, endOfDay, startOfDay } from 'date-fns'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useConfirm } from '@/composables/useConfirm'
import { useRecurringReschedule } from '@/features/tasks/lib/use-recurring-reschedule'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { tasksToCalendarEvents } from '../lib/calendar-events'
import { useCalendarDnd } from '../lib/use-calendar-dnd'
import { useGrabScroll } from '../lib/use-grab-scroll'
import { DAY_WIDTH, GUTTER_WIDTH, TRACK_WIDTH, useInfiniteDays } from '../lib/use-infinite-days'
import { formatDateRange, formatDayHeader, formatDayTitle, getWeekStart, isDateInRange, isToday, navigateWeek, pickDayViewDate } from '../lib/week'
import AllDaySection from './AllDaySection.vue'
import CalendarHeader from './CalendarHeader.vue'
import HourGrid from './HourGrid.vue'

const emit = defineEmits<{
  'open-task': [task: import('@/features/tasks/model/types').Task]
  'create-task': [payload: { date: Date, startMinutes: number, durationMinutes: number }]
}>()

const taskStore = useTaskStore()
const { startDrag } = useCalendarDnd()
const { rescheduleDueDate } = useRecurringReschedule()
const { confirm } = useConfirm()

const gridRef = ref<HTMLElement | null>(null)
const viewMode = ref<CalendarViewMode>('week')
const selectedDate = ref(startOfDay(new Date()))
const isDayView = computed(() => viewMode.value === 'day')

const {
  visibleDays: weekDays,
  dateRange,
  dayOffset: weekDayOffset,
  dateFromX: weekDateFromX,
  scrollToDate,
  onScroll: onWeekScroll,
  captureScrollLeft,
  restoreScrollLeft,
} = useInfiniteDays(gridRef)
const savedWeekScrollLeft = ref<number | null>(null)
const savedWeekRange = ref<{ start: Date, end: Date } | null>(null)
const suppressWeekScroll = ref(false)
const { width: gridWidth } = useElementSize(gridRef)
const {
  grabbing,
  ctrlHeld,
  onMouseDown: onGrabMouseDown,
  onMouseMove: onGrabMouseMove,
  onMouseUp: onGrabMouseUp,
} = useGrabScroll(gridRef)

const dayColumnWidth = computed(() => Math.max(200, (gridWidth.value || 800) - GUTTER_WIDTH))
const dayWidth = computed(() => isDayView.value ? dayColumnWidth.value : DAY_WIDTH)
const trackWidth = computed(() => isDayView.value ? dayColumnWidth.value : TRACK_WIDTH)

const visibleDays = computed(() =>
  isDayView.value ? [selectedDate.value] : weekDays.value,
)

function dayOffset(date: Date): number {
  if (isDayView.value)
    return 0
  return weekDayOffset(date)
}

function dateFromX(x: number): Date {
  if (isDayView.value)
    return selectedDate.value
  return weekDateFromX(x)
}

function onScroll() {
  if (isDayView.value || suppressWeekScroll.value)
    return
  onWeekScroll()
}

const grabCursor = computed(() => {
  if (grabbing.value)
    return 'cursor-grabbing'
  if (ctrlHeld.value)
    return 'cursor-grab'
  return ''
})

const rangeLabel = computed(() => {
  if (isDayView.value)
    return formatDayTitle(selectedDate.value)
  return formatDateRange(dateRange.value.start, dateRange.value.end)
})

const calendarEvents = computed(() => {
  const days = visibleDays.value
  if (days.length === 0)
    return []
  return tasksToCalendarEvents(
    taskStore.tasks,
    startOfDay(days[0]!),
    endOfDay(days[days.length - 1]!),
  )
})

function scrollToCurrentHour() {
  if (!gridRef.value)
    return
  const hour = new Date().getHours()
  gridRef.value.scrollTop = Math.max(0, (hour - 1) * 60)
}

function onViewModeChange(mode: CalendarViewMode) {
  if (mode === 'day') {
    savedWeekScrollLeft.value = captureScrollLeft()
    savedWeekRange.value = { start: dateRange.value.start, end: dateRange.value.end }
    selectedDate.value = pickDayViewDate(dateRange.value)
    viewMode.value = mode
    nextTick(() => {
      if (isToday(selectedDate.value))
        scrollToCurrentHour()
    })
    return
  }

  const savedLeft = savedWeekScrollLeft.value
  const savedRange = savedWeekRange.value
  const restoreWeek = savedLeft != null && savedRange != null
    && isDateInRange(selectedDate.value, savedRange.start, savedRange.end)

  suppressWeekScroll.value = true
  if (restoreWeek && savedLeft != null)
    restoreScrollLeft(savedLeft)
  viewMode.value = mode
  nextTick(() => {
    if (restoreWeek && savedLeft != null)
      restoreScrollLeft(savedLeft)
    else
      scrollToDate(selectedDate.value)
    requestAnimationFrame(() => {
      suppressWeekScroll.value = false
    })
  })
}

function onNavigate(direction: number) {
  if (isDayView.value) {
    selectedDate.value = addDays(selectedDate.value, direction)
    return
  }
  const currentWeekStart = getWeekStart(dateRange.value.start)
  scrollToDate(navigateWeek(currentWeekStart, direction), true)
}

function onToday() {
  const today = startOfDay(new Date())
  if (isDayView.value) {
    selectedDate.value = today
    nextTick(scrollToCurrentHour)
    return
  }
  scrollToDate(today, true)
}

function onDragStart(e: DragEvent, taskId: string) {
  startDrag(e, taskId)
}

async function applyTaskMove(taskId: string, newDate: Date, startMinutes?: number) {
  const date = new Date(newDate)
  if (startMinutes !== undefined) {
    date.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
  }
  else {
    date.setHours(0, 0, 0, 0)
  }
  try {
    const task = taskStore.tasks.find(t => t.id === taskId)
    if (!task)
      return
    await rescheduleDueDate(task, date)
  }
  catch (err) {
    console.error('Ошибка перемещения задачи:', err)
  }
}

async function onTaskMoved(taskId: string, newDate: Date, startMinutes: number) {
  await applyTaskMove(taskId, newDate, startMinutes)
}

async function onTaskResized(taskId: string, durationMinutes: number) {
  try {
    await taskStore.updateTask(taskId, { durationMinutes }, false)
  }
  catch (err) {
    console.error('Ошибка изменения длительности:', err)
  }
}

async function onToggleTask(taskId: string) {
  try {
    await taskStore.toggleTask(taskId)
  }
  catch (err) {
    console.error('Ошибка переключения задачи:', err)
  }
}

function onEventOpen(event: CalendarEvent) {
  if (!event.isVirtual) {
    emit('open-task', event.task)
  }
}

async function onMaterialize(event: CalendarEvent) {
  const ok = await confirm({
    title: 'Проявить задачу на этот день?',
    message: 'На этом дне появится настоящая задача. Призрак пропадёт.',
    confirmText: 'Проявить',
    rememberKey: 'alfy:skip-materialize-confirm',
    rememberLabel: 'Больше не показывать',
  })
  if (!ok)
    return
  try {
    await taskStore.materializeOccurrence(event.taskId)
  }
  catch (err) {
    console.error('Ошибка проявления задачи:', err)
  }
}

function onDrop(payload: CalendarDropPayload) {
  if (payload.isVirtual)
    return
  applyTaskMove(payload.taskId, payload.newDate, payload.startMinutes)
}

async function onSlotCreate(date: Date, startMinutes: number, durationMinutes: number) {
  emit('create-task', { date, startMinutes, durationMinutes })
}

onMounted(() => {
  if (taskStore.tasks.length === 0) {
    taskStore.fetchTasks()
  }
})
</script>

<template>
  <div class="flex flex-col bg-card overflow-hidden">
    <CalendarHeader
      :label="rangeLabel"
      :view-mode="viewMode"
      @navigate="onNavigate"
      @today="onToday"
      @update:view-mode="onViewModeChange"
    />

    <!-- Single scroll container for both axes -->
    <div
      ref="gridRef"
      class="flex-1 min-h-0 overflow-y-auto select-none" :class="[isDayView ? 'overflow-x-hidden' : 'overflow-x-auto', grabCursor]"
      @scroll="onScroll"
      @mousedown="onGrabMouseDown"
      @mousemove="onGrabMouseMove"
      @mouseup="onGrabMouseUp"
    >
      <div :style="{ width: `${trackWidth + GUTTER_WIDTH}px` }" class="relative">
        <!-- Day headers: sticky top -->
        <div class="sticky top-0 z-30 bg-card border-b border-border flex" style="height: 52px">
          <div class="w-14 shrink-0 border-r border-border/40 sticky left-0 z-40 bg-card" />
          <div class="relative" :style="{ width: `${trackWidth}px`, height: '52px' }">
            <div
              v-for="day in visibleDays"
              :key="`h-${day.toISOString()}`"
              class="absolute top-0 text-center py-2 border-r border-border/40" :class="[
                isToday(day) && 'bg-primary/5',
              ]"
              :style="{ left: `${dayOffset(day)}px`, width: `${dayWidth}px`, height: '52px' }"
            >
              <div class="text-[10px] uppercase text-muted-foreground">
                {{ formatDayHeader(day).dayName }}
              </div>
              <div
                class="text-sm font-medium" :class="[
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
          :day-width="dayWidth"
          :track-width="trackWidth"
          :events="calendarEvents"
          @drop="onDrop"
          @dragstart="onDragStart"
          @open="onEventOpen"
          @materialize="onMaterialize"
        />

        <!-- Hour grid -->
        <HourGrid
          :visible-days="visibleDays"
          :day-offset="dayOffset"
          :date-from-x="dateFromX"
          :day-width="dayWidth"
          :track-width="trackWidth"
          :events="calendarEvents"
          :grid-ref="gridRef"
          :on-task-moved="onTaskMoved"
          :on-task-resized="onTaskResized"
          :on-slot-create="onSlotCreate"
          @drop="onDrop"
          @open="onEventOpen"
          @toggle="onToggleTask"
          @materialize="onMaterialize"
        />
      </div>
    </div>
  </div>
</template>
