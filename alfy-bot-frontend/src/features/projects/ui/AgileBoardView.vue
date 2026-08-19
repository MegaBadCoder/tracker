<script setup lang="ts">
import type { BoardGroup } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { buildAgileRows } from '../lib/agile-layout'
import { useColumnStore } from '../model/column-store'
import { useGroupStore } from '../model/group-store'
import AgileCell from './AgileCell.vue'
import AgileEpicBlock from './AgileEpicBlock.vue'

const props = withDefaults(defineProps<{
  projectId: string
  showCompleted?: boolean
  hideOverdue?: boolean
}>(), {
  showCompleted: true,
  hideOverdue: true,
})

defineEmits<{
  toggleTask: [id: string]
  openTask: [task: Task]
}>()

const COLUMN_WIDTH_PX = 260

const columnStore = useColumnStore()
const groupStore = useGroupStore()
const taskStore = useTaskStore()
const { tasks } = storeToRefs(taskStore)

const sortedColumns = computed(() =>
  [...columnStore.columns].sort((a, b) => a.order - b.order),
)

const projectTasks = computed(() =>
  tasks.value.filter(t =>
    t.projectId === props.projectId
    && (props.showCompleted || !t.completed)
    && (!props.hideOverdue || !t.isOverdue),
  ),
)

const rows = computed(() => buildAgileRows(groupStore.groups, projectTasks.value))

function columnTaskCount(columnId: string): number {
  return projectTasks.value.filter(t => t.columnId === columnId).length
}

function ungroupedTasksByColumn(tasksInRow: Task[]) {
  const map = new Map<string, Task[]>()
  for (const task of tasksInRow) {
    if (task.columnId) {
      const arr = map.get(task.columnId) ?? []
      arr.push(task)
      map.set(task.columnId, arr)
    }
  }
  return map
}

async function handleToggleEpicDone(epic: BoardGroup) {
  await groupStore.toggleEpicDone(props.projectId, epic)
}

watch(() => props.projectId, (id) => {
  if (id) {
    columnStore.fetchColumns(id)
    groupStore.fetchGroups(id)
  }
}, { immediate: true })
</script>

<template>
  <div v-if="columnStore.loading || groupStore.loading" class="text-center py-8">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
  </div>
  <div v-else class="overflow-x-auto pb-4 h-full">
    <div class="grid" :style="{ gridTemplateColumns: `repeat(${sortedColumns.length}, ${COLUMN_WIDTH_PX}px)` }">
      <div class="contents">
        <div
          v-for="column in sortedColumns"
          :key="column.id"
          class="sticky top-0 z-10 bg-background border-b border-border px-3 py-2 flex items-center gap-2"
        >
          <div
            v-if="column.color"
            class="w-2 h-2 rounded-full shrink-0"
            :style="{ backgroundColor: column.color }"
          />
          <span class="text-sm font-medium truncate">{{ column.title }}</span>
          <span class="text-xs text-muted-foreground shrink-0">{{ columnTaskCount(column.id) }}</span>
        </div>
      </div>

      <template v-for="row in rows" :key="row.kind === 'epic' ? row.epic.id : 'ungrouped'">
        <AgileEpicBlock
          v-if="row.kind === 'epic'"
          :epic="row.epic"
          :stories="row.stories"
          :epic-tasks="row.epicTasks"
          :columns="sortedColumns"
          @toggle-task="$emit('toggleTask', $event)"
          @open-task="$emit('openTask', $event)"
          @toggle-done="handleToggleEpicDone(row.epic)"
        />
        <div v-else class="col-span-full grid [grid-template-columns:subgrid] border-t-2 border-border">
          <div class="col-span-full px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Без эпика
          </div>
          <AgileCell
            v-for="column in sortedColumns"
            :key="column.id"
            :tasks="ungroupedTasksByColumn(row.tasks).get(column.id) ?? []"
            @toggle-task="$emit('toggleTask', $event)"
            @open-task="$emit('openTask', $event)"
          />
        </div>
      </template>
    </div>
  </div>
</template>
