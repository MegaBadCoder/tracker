<template>
  <div
    role="listitem"
    :class="[
      'group flex items-center gap-3 px-4 py-3 min-h-[44px] cursor-pointer transition-all duration-200 hover:bg-muted/60 hover:shadow-sm hover:pl-5',
      task.completed && 'opacity-50'
    ]"
    @click="$emit('open', task)"
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
      <div v-if="hasMeta" class="flex flex-wrap items-center gap-1.5 mt-1">
        <Badge
          v-if="task.isPomodoroTask"
          variant="outline"
          class="gap-1 text-[11px] px-2 py-0.5 h-5 border-transparent rounded-full bg-muted text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors duration-150"
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
          <Flag :size="11" :class="priorityIconColor" />
          {{ PRIORITY_LABELS[task.priority] }}
        </Badge>
        <Badge
          v-if="task.dueDate"
          variant="outline"
          class="gap-1 text-[11px] px-2 py-0.5 h-5 border-transparent rounded-full bg-muted text-muted-foreground"
        >
          <CalendarIcon :size="11" />
          {{ formatDate(task.dueDate, 'd MMM') }}
        </Badge>
        <Badge
          v-if="task.deadline"
          variant="outline"
          class="gap-1 text-[11px] px-2 py-0.5 h-5 border-transparent rounded-full bg-muted text-muted-foreground"
        >
          <Clock :size="11" />
          {{ formatDate(task.deadline, 'd MMM, HH:mm') }}
        </Badge>
        <Badge
          v-if="task.location"
          variant="outline"
          class="gap-1 text-[11px] px-2 py-0.5 h-5 border-transparent rounded-full bg-muted text-muted-foreground"
        >
          <MapPin :size="11" />
          {{ task.location }}
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
import { formatDate, formatPomodoro } from '../lib/formatters'
import { PRIORITY_LABELS } from '../model/constants'
import type { TaskCardProps, TaskCardEmits } from '../model/types'

const props = defineProps<TaskCardProps>()
defineEmits<TaskCardEmits>()

const priorityIconColor = computed(() => {
  const colors = {
    high: 'text-red-500',
    medium: 'text-yellow-500',
    low: 'text-green-500',
  }
  return props.task.priority ? colors[props.task.priority] : ''
})

const hasMeta = computed(() =>
  props.task.priority || props.task.dueDate || props.task.deadline || props.task.location || props.task.isPomodoroTask
)

</script>
