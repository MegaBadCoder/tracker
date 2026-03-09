<template>
  <div
    :class="[
      'bg-card rounded-xl p-4 border border-border shadow-sm transition-all hover:shadow-md hover:scale-[1.01] relative',
      priorityClasses,
      task.completed && 'opacity-60'
    ]"
  >
    <button
      @click="$emit('delete', task.id)"
      class="absolute top-2 right-2 p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
      title="Удалить задачу"
    >
      <Trash2 :size="16" />
    </button>
    <div class="flex-1 space-y-2">
      <TaskCardHeader
        :title="task.title"
        :completed="task.completed"
        @toggle="$emit('toggle', task.id)"
      />

      <TaskCardBadges
        :due-date="task.dueDate"
        :deadline="task.deadline"
        :priority="task.priority"
        :location="task.location"
        :tags="task.tags"
        :is-pomodoro-task="task.isPomodoroTask"
        :pomodoro-completed="task.pomodoroCompleted"
        :pomodoro-count="task.pomodoroCount"
        @show-timer="$emit('showTimer', task.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import TaskCardHeader from './TaskCardHeader.vue'
import TaskCardBadges from './TaskCardBadges.vue'
import { getPriorityClasses } from '../lib/priority'
import type { TaskCardProps, TaskCardEmits } from '../model/types'

const props = defineProps<TaskCardProps>()
defineEmits<TaskCardEmits>()

const priorityClasses = computed(() => getPriorityClasses(props.task.priority))
</script>
