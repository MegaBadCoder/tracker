<script setup lang="ts">
import type { TaskCardEmits, TaskCardProps } from '../model/types'
import { Calendar as CalendarIcon, CheckSquare, Clock, Flag, FolderOpen, GripVertical, MapPin, Repeat, Timer, Trash2 } from 'lucide-vue-next'
import { computed, ref, toRef } from 'vue'
import { Badge } from '@/components/ui/badge'
import { RoundCheckbox } from '@/components/ui/roundCheckbox'
import { computeChecklistProgress } from '../lib/checklist'
import { useDragSource } from '../lib/dnd/use-drag-source'
import { DATE_SHORT, DATE_WITH_TIME, formatDate, formatPomodoro } from '../lib/formatters'
import { getPriorityColor } from '../lib/priority'
import { PRIORITY_LABELS } from '../model/constants'

const props = defineProps<TaskCardProps>()
const emit = defineEmits<TaskCardEmits>()

const cardEl = ref<HTMLElement | null>(null)
const handleEl = ref<HTMLElement | null>(null)

useDragSource({
  task: toRef(props, 'task'),
  cardEl,
  handleEl,
  onTap: () => emit('open', props.task),
})

const isCompact = computed(() => props.variant === 'compact')

const checklistStats = computed(() => computeChecklistProgress(props.task.checklist?.items ?? []))
const checklistTotal = computed(() => checklistStats.value.total)
const checklistDone = computed(() => checklistStats.value.completed)

const hasMeta = computed(() =>
  props.projectName || props.task.priority || props.task.dueDate || props.task.deadline || props.task.location || props.task.isPomodoroTask || props.task.recurrence || checklistTotal.value > 0,
)
</script>

<template>
  <div
    ref="cardEl"
    role="listitem"
    :data-task-id="task.id"
    class="group flex items-center gap-2 cursor-pointer transition-all duration-200 hover:bg-muted/60 hover:shadow-sm" :class="[
      isCompact ? 'pl-1 pr-3 py-2 min-h-[36px]' : 'pl-1 pr-4 py-3 min-h-[44px]',
      task.isOverdue
        ? 'border-l-4 border-red-500 bg-red-500/10 dark:bg-red-500/20'
        : task.completed && 'opacity-50',
    ]"
  >
    <!-- Drag handle -->
    <button
      ref="handleEl"
      class="task-drag-handle cursor-grab touch-none flex-shrink-0 p-0.5 text-muted-foreground opacity-0 group-hover:opacity-60 focus:outline-none"
      data-no-drag="true"
      tabindex="-1"
      type="button"
      aria-label="Перетащить задачу"
    >
      <GripVertical :size="14" />
    </button>

    <!-- Checkbox -->
    <RoundCheckbox
      :model-value="task.completed"
      :disabled="task.isOverdue"
      class="shrink-0"
      data-no-drag="true"
      @click.stop
      @update:model-value="$emit('toggle', task.id)"
    />

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span
          class="text-sm truncate" :class="[
            task.isOverdue
              ? 'text-red-600 dark:text-red-400 font-medium'
              : task.completed
                ? 'line-through text-muted-foreground'
                : 'text-foreground',
          ]"
        >
          {{ task.title }}
        </span>
      </div>

      <!-- Meta chips -->
      <div v-if="hasMeta" class="flex flex-wrap items-center gap-1.5 mt-1">
        <Badge
          v-if="projectName"
          variant="outline"
          class="gap-1 text-[11px] px-2 py-0.5 h-5 border-transparent rounded-full bg-muted text-muted-foreground"
        >
          <FolderOpen :size="11" />
          {{ projectName }}
        </Badge>
        <Badge
          v-if="task.isPomodoroTask"
          variant="outline"
          class="gap-1 text-[11px] px-2 py-0.5 h-5 border-transparent rounded-full bg-muted text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors duration-150"
          data-no-drag="true"
          @click.stop="$emit('showTimer', task.id)"
        >
          <Timer :size="11" />
          {{ formatPomodoro(task.pomodoroCompleted || 0) }}/{{ task.pomodoroCount || 0 }}
        </Badge>
        <Badge
          v-if="task.priority"
          variant="outline"
          class="gap-1 text-[11px] px-2 py-0.5 h-5 border-transparent rounded-full bg-muted text-muted-foreground"
        >
          <Flag :size="11" :class="task.priority && getPriorityColor(task.priority)" />
          {{ PRIORITY_LABELS[task.priority] }}
        </Badge>
        <Badge
          v-if="task.dueDate"
          variant="outline"
          class="gap-1 text-[11px] px-2 py-0.5 h-5 border-transparent rounded-full bg-muted text-muted-foreground"
        >
          <CalendarIcon :size="11" />
          {{ formatDate(task.dueDate, DATE_SHORT) }}
        </Badge>
        <Badge
          v-if="task.deadline"
          variant="outline"
          class="gap-1 text-[11px] px-2 py-0.5 h-5 border-transparent rounded-full bg-muted text-muted-foreground"
        >
          <Clock :size="11" />
          {{ formatDate(task.deadline, DATE_WITH_TIME) }}
        </Badge>
        <Badge
          v-if="task.location"
          variant="outline"
          class="gap-1 text-[11px] px-2 py-0.5 h-5 border-transparent rounded-full bg-muted text-muted-foreground"
        >
          <MapPin :size="11" />
          {{ task.location }}
        </Badge>
        <Badge
          v-if="task.recurrence"
          variant="outline"
          class="gap-1 text-[11px] px-2 py-0.5 h-5 border-transparent rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400"
        >
          <Repeat :size="11" />
        </Badge>
        <Badge
          v-if="checklistTotal > 0"
          variant="outline"
          class="gap-1 text-[11px] px-2 py-0.5 h-5 border-transparent rounded-full" :class="[
            checklistDone === checklistTotal
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-muted text-muted-foreground',
          ]"
        >
          <CheckSquare :size="11" />
          {{ checklistDone }}/{{ checklistTotal }}
        </Badge>
      </div>
    </div>

    <!-- Tags -->
    <div v-if="!isCompact && task.tags?.length" class="hidden sm:flex items-center gap-1 shrink-0">
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
      v-if="!isCompact"
      class="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all duration-150 cursor-pointer"
      title="Удалить"
      data-no-drag="true"
      @click.stop="$emit('delete', task.id)"
    >
      <Trash2 :size="14" />
    </button>
  </div>
</template>

<style scoped>
@media (pointer: coarse) {
  .task-drag-handle {
    opacity: 0.6;
  }
}
</style>
