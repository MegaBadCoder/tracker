<template>
  <div
    data-calendar-event-block
    :class="[
      'absolute rounded-md px-2 py-1 text-xs overflow-hidden',
      hidden ? 'invisible' : isOverdue ? 'cursor-not-allowed' : isVirtual ? 'cursor-default' : 'cursor-grab',
      isOverdue
        ? OVERDUE_EVENT_CLASSES
        : completed
          ? COMPLETED_EVENT_CLASSES
          : isVirtual
            ? VIRTUAL_EVENT_CLASSES
            : DEFAULT_EVENT_CLASSES,
      highlighted && 'ring-2 ring-inset ring-primary z-20',
    ]"
    :style="blockStyle"
    style="touch-action: none"
    @pointerdown="onPointerDown"
  >
    <span
      v-if="showPriorityMarks"
      data-testid="event-side-stripe"
      :class="[EVENT_SIDE_STRIPE_CLASSES, event.priority && getPriorityStripeClass(event.priority)]"
      aria-hidden="true"
    />
    <div :class="['font-medium flex items-center gap-1 min-w-0', completed && 'line-through']">
      <RoundCheckbox
        v-if="!isVirtual && !isOverdue"
        :model-value="completed"
        class="shrink-0 scale-75 origin-center calendar-checkbox"
        @click.stop
        @pointerdown.stop
        @update:model-value="emit('toggle', event.taskId)"
      />
      <Repeat v-if="event.isRecurring" :size="10" class="shrink-0" />
      <Target
        v-if="event.task.goalIds && event.task.goalIds.length > 0"
        :size="10"
        class="shrink-0"
        data-testid="goal-link-icon"
      />
      <Flag
        v-if="showPriorityMarks"
        :size="10"
        data-testid="priority-flag"
        class="shrink-0"
        :class="event.priority && getPriorityColor(event.priority)"
        :aria-label="event.priority && PRIORITY_LABELS[event.priority]"
      />
      <span class="truncate">{{ event.title }}</span>
      <button
        v-if="isVirtual"
        type="button"
        data-testid="materialize-occurrence"
        class="ml-auto shrink-0 rounded p-0.5 hover:bg-foreground/10"
        aria-label="Проявить задачу"
        @pointerdown.stop
        @click.stop="emit('materialize', event)"
      >
        <CalendarPlus :size="12" />
      </button>
    </div>
    <div class="text-[10px] opacity-80">
      {{ timeLabel }}
    </div>
    <div v-if="event.pomodoroLabel" class="text-[10px] opacity-80 flex items-center gap-0.5">
      <Timer :size="8" class="shrink-0" />
      {{ event.pomodoroLabel }}
    </div>
    <div
      v-if="event.resizable && !isOverdue"
      data-testid="resize-handle"
      class="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
      @pointerdown.stop="onResizeDown"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CalendarPlus, Flag, Repeat, Target, Timer } from 'lucide-vue-next'
import RoundCheckbox from '@/components/ui/roundCheckbox/RoundCheckbox.vue'
import type { CalendarEvent } from '../model/types'
import { PRIORITY_LABELS } from '@/features/tasks/model/constants'
import { getPriorityColor, getPriorityStripeClass } from '@/features/tasks/lib/priority'
import {
  COMPLETED_EVENT_CLASSES,
  DEFAULT_EVENT_CLASSES,
  EVENT_SIDE_STRIPE_CLASSES,
  OVERDUE_EVENT_CLASSES,
  VIRTUAL_EVENT_CLASSES,
} from '../lib/calendar-styles'
import { eventColumnStyle, type EventColumn } from '../lib/layout-overlapping'
import { highlightedTaskId } from '@/features/tasks/lib/use-recurring-reschedule'

const HOUR_HEIGHT = 60
const TOTAL_MINUTES = 24 * 60

const props = defineProps<{
  event: CalendarEvent
  hidden?: boolean
  layout?: EventColumn
}>()

const emit = defineEmits<{
  grab: [event: CalendarEvent, pointerEvent: PointerEvent]
  'resize-start': [event: CalendarEvent, pointerEvent: PointerEvent]
  toggle: [taskId: string]
  materialize: [event: CalendarEvent]
}>()

const completed = computed(() => props.event.completed)
const isVirtual = computed(() => !!props.event.isVirtual)
const isOverdue = computed(() => !!props.event.task.isOverdue)
const showPriorityMarks = computed(() =>
  !!props.event.priority && !isOverdue.value && !isVirtual.value && !completed.value,
)
const highlighted = computed(() => highlightedTaskId.value === props.event.taskId)

const blockStyle = computed(() => {
  const top = (props.event.startMinutes / TOTAL_MINUTES) * HOUR_HEIGHT * 24
  const height = Math.max((props.event.durationMinutes / TOTAL_MINUTES) * HOUR_HEIGHT * 24, 20)
  return {
    top: `${top}px`,
    height: `${height}px`,
    ...eventColumnStyle(props.layout ?? { col: 0, cols: 1 }),
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
  if (e.button !== 0 || isVirtual.value || isOverdue.value) return
  emit('grab', props.event, e)
}

function onResizeDown(e: PointerEvent) {
  if (e.button !== 0) return
  emit('resize-start', props.event, e)
}
</script>

<style scoped>
.calendar-checkbox :deep(.round-checkbox__icon div) {
  border-color: currentColor;
  opacity: 0.6;
  width: 1rem;
  height: 1rem;
}

.calendar-checkbox:hover :deep(.round-checkbox__icon div) {
  opacity: 1;
}
</style>
