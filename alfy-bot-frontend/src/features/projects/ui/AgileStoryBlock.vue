<script setup lang="ts">
import type { BoardGroupNode, ProjectColumn } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { computed } from 'vue'
import AgileCell from './AgileCell.vue'

const props = defineProps<{
  story: BoardGroupNode
  tasks: Task[]
  columns: ProjectColumn[]
}>()

defineEmits<{
  toggleTask: [id: string]
  openTask: [task: Task]
}>()

const tasksByColumn = computed(() => {
  const map = new Map<string, Task[]>()
  for (const task of props.tasks) {
    if (task.columnId) {
      const arr = map.get(task.columnId) ?? []
      arr.push(task)
      map.set(task.columnId, arr)
    }
  }
  return map
})
</script>

<template>
  <div class="col-span-full grid [grid-template-columns:subgrid] border-t border-border/60">
    <div class="col-span-full flex items-center gap-2 px-3 py-1.5 bg-muted/20">
      <span class="text-xs font-medium text-muted-foreground truncate">{{ story.title }}</span>
      <span class="text-[11px] text-muted-foreground/60">{{ tasks.length }}</span>
    </div>
    <AgileCell
      v-for="column in columns"
      :key="column.id"
      :tasks="tasksByColumn.get(column.id) ?? []"
      @toggle-task="$emit('toggleTask', $event)"
      @open-task="$emit('openTask', $event)"
    />
  </div>
</template>
