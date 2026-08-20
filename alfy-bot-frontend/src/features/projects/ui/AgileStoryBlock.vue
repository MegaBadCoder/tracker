<script setup lang="ts">
import type { BoardGroupNode, ProjectColumn } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { computed } from 'vue'
import { groupTasksByColumn } from '../lib/agile-layout'
import AgileCell from './AgileCell.vue'

const props = defineProps<{
  story: BoardGroupNode
  tasks: Task[]
  lanes: ProjectColumn[]
}>()

defineEmits<{
  toggleTask: [id: string]
  openTask: [task: Task]
  taskChange: [event: any, columnId: string | null, groupId: string | null, tasks: Task[]]
}>()

const tasksByColumn = computed(() => groupTasksByColumn(props.tasks))
</script>

<template>
  <div class="col-span-full grid [grid-template-columns:subgrid] border-t border-border/60">
    <div class="col-span-full flex items-center gap-2 px-3 py-1.5 bg-muted/20">
      <span class="text-xs font-medium text-muted-foreground truncate">{{ story.title }}</span>
      <span class="text-[11px] text-muted-foreground/60">{{ tasks.length }}</span>
    </div>
    <AgileCell
      v-for="lane in lanes"
      :key="lane.id"
      :tasks="tasksByColumn.get(lane.id) ?? []"
      :column-id="lane.id"
      :group-id="story.id"
      @toggle-task="$emit('toggleTask', $event)"
      @open-task="$emit('openTask', $event)"
      @task-change="(...args) => $emit('taskChange', ...args)"
    />
  </div>
</template>
