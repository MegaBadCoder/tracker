<template>
  <div class="space-y-4">
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

const uncategorizedTasks = computed(() =>
  props.tasks
    .filter(t => !t.columnId)
    .sort((a, b) => {
      if (a.completed === b.completed) return (a.order ?? 0) - (b.order ?? 0)
      return a.completed ? 1 : -1
    }),
)

function getColumnTasks(columnId: string): Task[] {
  return props.tasks
    .filter(t => t.columnId === columnId)
    .sort((a, b) => {
      if (a.completed === b.completed) return (a.order ?? 0) - (b.order ?? 0)
      return a.completed ? 1 : -1
    })
}

function columnTaskCount(columnId: string): number {
  return props.tasks.filter(t => t.columnId === columnId).length
}
</script>
