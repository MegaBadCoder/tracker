<template>
  <div
    :class="[
      'group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/50',
      task.completed && 'opacity-50'
    ]"
  >
    <!-- Checkbox -->
    <RoundCheckbox
      :model-value="task.completed"
      class="shrink-0"
      @update:model-value="$emit('toggle', task.id)"
    />

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <!-- Priority indicator -->
        <div
          v-if="task.priority"
          :class="['w-1.5 h-1.5 rounded-full shrink-0', priorityDotColor]"
        />
        <span
          :class="[
            'text-sm truncate',
            task.completed ? 'line-through text-muted-foreground' : 'text-foreground'
          ]"
        >
          {{ task.title }}
        </span>
      </div>

      <!-- Meta chips -->
      <div v-if="hasMeta" class="flex flex-wrap items-center gap-1 mt-1">
        <Badge v-if="task.dueDate" variant="outline" class="gap-1 text-[11px] px-1.5 py-0 h-5">
          <CalendarIcon :size="11" />
          {{ formatDate(task.dueDate, 'MMM d') }}
        </Badge>
        <Badge
          v-if="task.deadline"
          variant="outline"
          class="gap-1 text-[11px] px-1.5 py-0 h-5 text-orange-600 border-orange-300/50 dark:text-orange-400 dark:border-orange-500/30"
        >
          <Clock :size="11" />
          {{ formatDate(task.deadline, 'MMM d, HH:mm') }}
        </Badge>
        <Badge v-if="task.priority" variant="outline" :class="['gap-1 text-[11px] px-1.5 py-0 h-5', priorityChipClass]">
          <Flag :size="11" />
          {{ PRIORITY_LABELS[task.priority] }}
        </Badge>
        <Badge v-if="task.location" variant="outline" class="gap-1 text-[11px] px-1.5 py-0 h-5">
          <MapPin :size="11" />
          {{ task.location }}
        </Badge>
        <Badge
          v-if="task.isPomodoroTask"
          variant="outline"
          class="gap-1 text-[11px] px-1.5 py-0 h-5 text-red-600 border-red-300/50 bg-red-50 dark:text-red-400 dark:border-red-500/30 dark:bg-red-500/10 cursor-pointer hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors duration-150"
          @click.stop="$emit('showTimer', task.id)"
        >
          <Timer :size="11" />
          {{ formatPomodoro(task.pomodoroCompleted || 0) }}/{{ task.pomodoroCount || 0 }}
        </Badge>
      </div>
    </div>

    <!-- Tags (compact) -->
    <div v-if="task.tags?.length" class="hidden sm:flex items-center gap-1 shrink-0">
      <Badge
        v-for="tag in task.tags.slice(0, 2)"
        :key="tag"
        variant="secondary"
        class="text-[10px] px-1.5 py-0"
      >
        {{ tag }}
      </Badge>
      <span v-if="task.tags.length > 2" class="text-[10px] text-muted-foreground">
        +{{ task.tags.length - 2 }}
      </span>
    </div>

    <!-- Delete -->
    <button
      class="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all duration-150 cursor-pointer"
      title="Удалить"
      @click.stop="$emit('delete', task.id)"
    >
      <Trash2 :size="14" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Calendar as CalendarIcon, Clock, Flag, MapPin, Timer, Trash2 } from 'lucide-vue-next'
import { RoundCheckbox } from '@/components/ui/roundCheckbox'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '../lib/formatters'
import { PRIORITY_LABELS } from '../model/constants'
import type { TaskCardProps, TaskCardEmits } from '../model/types'

const props = defineProps<TaskCardProps>()
defineEmits<TaskCardEmits>()

const priorityDotColor = computed(() => {
  const colors = {
    high: 'bg-red-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
  }
  return props.task.priority ? colors[props.task.priority] : ''
})

const priorityChipClass = computed(() => {
  const classes = {
    high: 'text-red-600 border-red-300/50 dark:text-red-400 dark:border-red-500/30',
    medium: 'text-yellow-600 border-yellow-300/50 dark:text-yellow-400 dark:border-yellow-500/30',
    low: 'text-green-600 border-green-300/50 dark:text-green-400 dark:border-green-500/30',
  }
  return props.task.priority ? classes[props.task.priority] : ''
})

const hasMeta = computed(() =>
  props.task.dueDate || props.task.deadline || props.task.location || props.task.isPomodoroTask
)

function formatPomodoro(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
</script>
