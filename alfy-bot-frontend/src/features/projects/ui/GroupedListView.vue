<template>
  <div v-if="tasks.length === 0 && columns.length === 0" class="p-6 text-center text-muted-foreground">
    В этом проекте пока нет задач.
  </div>
  <div v-else class="space-y-4">
    <!-- Uncategorized -->
    <div v-if="uncategorizedTasks.length > 0">
      <div class="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <span>Без раздела</span>
        <span class="text-muted-foreground/60">{{ uncategorizedTasks.length }}</span>
      </div>
      <div role="list" class="divide-y divide-border">
        <TaskCard
          v-for="task in uncategorizedTasks"
          :key="task.id"
          :task="task"
          @toggle="$emit('toggleTask', $event)"
          @open="$emit('openTask', $event)"
          @delete="$emit('deleteTask', $event)"
          @show-timer="$emit('showTimer', $event)"
        />
      </div>
    </div>

    <!-- Grouped by column -->
    <div v-for="col in sortedColumns" :key="col.id">
      <div class="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <div
          v-if="col.color"
          class="w-2 h-2 rounded-full"
          :style="{ backgroundColor: col.color }"
        />
        <span>{{ col.title }}</span>
        <span class="text-muted-foreground/60">{{ columnTaskCount(col.id) }}</span>
      </div>
      <div role="list" class="divide-y divide-border">
        <TaskCard
          v-for="task in getColumnTasks(col.id)"
          :key="task.id"
          :task="task"
          @toggle="$emit('toggleTask', $event)"
          @open="$emit('openTask', $event)"
          @delete="$emit('deleteTask', $event)"
          @show-timer="$emit('showTimer', $event)"
        />
      </div>
      <div v-if="columnTaskCount(col.id) === 0" class="px-4 py-3 text-sm text-muted-foreground/60">
        Нет задач
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TaskCard from '@/features/tasks/ui/TaskCard.vue'
import type { ProjectColumn } from '../model/types'
import type { Task } from '@/features/tasks/model/types'

const props = defineProps<{
  columns: ProjectColumn[]
  tasks: Task[]
}>()

defineEmits<{
  toggleTask: [id: string]
  openTask: [task: Task]
  deleteTask: [id: string]
  showTimer: [id: string]
}>()

const sortedColumns = computed(() =>
  [...props.columns].sort((a, b) => a.order - b.order),
)

function taskWeight(t: Task): number {
  return (t.isOverdue ? 2 : 0) + (t.completed ? 1 : 0)
}

function compareTasks(a: Task, b: Task): number {
  const wd = taskWeight(a) - taskWeight(b)
  if (wd !== 0) return wd
  return (a.order ?? 0) - (b.order ?? 0)
}

const uncategorizedTasks = computed(() =>
  props.tasks.filter(t => !t.columnId).sort(compareTasks),
)

function getColumnTasks(columnId: string): Task[] {
  return props.tasks.filter(t => t.columnId === columnId).sort(compareTasks)
}

function columnTaskCount(columnId: string): number {
  return props.tasks.filter(t => t.columnId === columnId).length
}
</script>
