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
  <!-- Вложенность читается слоями, а не вдвинутым прямоугольником: отступ или
       margin на этом блоке сдвинул бы его subgrid-колонки относительно эпика
       и разломал сквозное выравнивание. Поэтому поверхность светлее эпика,
       рейл тоньше, подпись с отступом. -->
  <div
    class="col-span-full grid [grid-template-columns:subgrid] bg-muted/[0.12]"
    style="box-shadow: inset 2px 0 0 0 color-mix(in oklab, var(--border) 90%, transparent)"
  >
    <div class="col-span-full flex items-center gap-2 pl-8 pr-3 py-1.5 bg-muted/25">
      <span class="text-xs font-medium text-foreground/80 truncate">{{ story.title }}</span>
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
