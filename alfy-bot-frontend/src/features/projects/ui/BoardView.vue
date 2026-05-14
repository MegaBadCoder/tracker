<script setup lang="ts">
import type { Task } from '@/features/tasks/model/types'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import draggable from 'vuedraggable'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { useBoardDnd } from '../lib/use-board-dnd'
import { useColumnStore } from '../model/column-store'
import AddColumnButton from './AddColumnButton.vue'
import BoardColumn from './BoardColumn.vue'

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

const columnStore = useColumnStore()
const taskStore = useTaskStore()
const { tasks } = storeToRefs(taskStore)
const { onTaskChange, onColumnReorder } = useBoardDnd(taskStore, columnStore)

const projectTasks = computed(() =>
  tasks.value.filter(t =>
    t.projectId === props.projectId
    && (props.showCompleted || !t.completed)
    && (!props.hideOverdue || !t.isOverdue),
  ),
)

const sortedColumns = computed(() =>
  [...columnStore.columns].sort((a, b) => a.order - b.order),
)

const tasksByColumn = computed(() => {
  const map = new Map<string, Task[]>()
  for (const task of projectTasks.value) {
    if (task.columnId) {
      const arr = map.get(task.columnId) ?? []
      arr.push(task)
      map.set(task.columnId, arr)
    }
  }
  for (const [key, arr] of map) {
    map.set(key, arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
  }
  return map
})

const uncategorizedTasks = computed(() =>
  projectTasks.value
    .filter(t => !t.columnId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
)

function handleTaskChange(event: any, columnId: string | null, columnTasks: Task[]) {
  onTaskChange(event, columnId, props.projectId, columnTasks)
}

function handleColumnReorder() {
  onColumnReorder(props.projectId, sortedColumns.value)
}

async function handleAddColumn(title: string) {
  await columnStore.createColumn(props.projectId, { title })
}

async function handleDeleteColumn(columnId: string) {
  await columnStore.deleteColumn(props.projectId, columnId)
}

async function handleRenameColumn(columnId: string, title: string) {
  await columnStore.updateColumn(props.projectId, columnId, { title })
}

watch(() => props.projectId, (id) => {
  if (id)
    columnStore.fetchColumns(id)
}, { immediate: true })
</script>

<template>
  <div v-if="columnStore.loading" class="text-center py-8">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
  </div>
  <div v-else class="flex gap-4 overflow-x-auto pb-4 h-full items-start">
    <!-- Uncategorized column -->
    <BoardColumn
      :column="null"
      :tasks="uncategorizedTasks"
      :project-id="projectId"
      @task-change="handleTaskChange"
      @toggle-task="$emit('toggleTask', $event)"
      @open-task="$emit('openTask', $event)"
    />

    <!-- Regular columns -->
    <draggable
      :model-value="sortedColumns"
      item-key="id"
      handle=".column-drag-handle"
      :animation="150"
      ghost-class="opacity-30"
      class="flex gap-4"
      @end="handleColumnReorder"
    >
      <template #item="{ element: col }">
        <BoardColumn
          :column="col"
          :tasks="tasksByColumn.get(col.id) ?? []"
          :project-id="projectId"
          @task-change="handleTaskChange"
          @toggle-task="$emit('toggleTask', $event)"
          @open-task="$emit('openTask', $event)"
          @delete-column="handleDeleteColumn(col.id)"
          @rename-column="handleRenameColumn(col.id, $event)"
        />
      </template>
    </draggable>

    <!-- Add column -->
    <AddColumnButton @add="handleAddColumn" />
  </div>
</template>
