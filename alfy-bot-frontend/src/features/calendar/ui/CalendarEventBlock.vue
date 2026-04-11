<template>
  <div
    :class="[
      'absolute left-0.5 right-0.5 rounded-md px-2 py-1 text-xs overflow-hidden border',
      hidden ? 'invisible' : isVirtual ? 'cursor-default' : 'cursor-grab',
      completed
        ? 'bg-emerald-500/25 border-emerald-500/40 text-white backdrop-blur-sm'
        : isVirtual
          ? 'border-dashed border-border/40 bg-muted/60 text-white backdrop-blur-sm'
          : priorityClasses,
    ]"
    :style="blockStyle"
    style="touch-action: none"
    @pointerdown="onPointerDown"
  >
    <div :class="['font-medium truncate flex items-center gap-1', completed && 'line-through']">
      <RoundCheckbox
        v-if="!isVirtual"
        :model-value="completed"
        class="shrink-0 scale-75 origin-center calendar-checkbox"
        @click.stop
        @pointerdown.stop
        @update:model-value="emit('toggle', event.taskId)"
      />
      <Repeat v-if="event.isRecurring" :size="10" class="shrink-0" />
      {{ event.title }}
    </div>
    <div class="text-[10px] opacity-80">
      {{ timeLabel }}
    </div>
    <div v-if="event.pomodoroLabel" class="text-[10px] opacity-80 flex items-center gap-0.5">
      <Timer :size="8" class="shrink-0" />
      {{ event.pomodoroLabel }}
    </div>
    <div
      v-if="event.resizable"
      data-testid="resize-handle"
      class="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-white/20 transition-colors"
      @pointerdown.stop="onResizeDown"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Repeat, Timer } from 'lucide-vue-next'
import RoundCheckbox from '@/components/ui/roundCheckbox/RoundCheckbox.vue'
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
  'resize-start': [event: CalendarEvent, pointerEvent: PointerEvent]
  toggle: [taskId: string]
}>()

const completed = computed(() => props.event.completed)
const isVirtual = computed(() => !!props.event.isVirtual)
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
  if (e.button !== 0 || isVirtual.value) return
  emit('grab', props.event, e)
}

function onResizeDown(e: PointerEvent) {
  if (e.button !== 0) return
  emit('resize-start', props.event, e)
}
</script>

<style scoped>
.calendar-checkbox :deep(.round-checkbox__icon div) {
  border-color: rgba(255, 255, 255, 0.6);
  width: 1rem;
  height: 1rem;
}

.calendar-checkbox:hover :deep(.round-checkbox__icon div) {
  border-color: #fff;
}
</style>
