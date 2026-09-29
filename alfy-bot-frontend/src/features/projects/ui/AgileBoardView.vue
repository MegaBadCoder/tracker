<script setup lang="ts">
import type { BoardGroup, ProjectColumn } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { buildAgileRows, groupTasksByColumn } from '../lib/agile-layout'
import { useAgileDnd } from '../lib/use-agile-dnd'
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
const { onTaskChange } = useAgileDnd(taskStore)

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

// Board lanes are exactly the project's columns. Tasks with columnId === null
// are backlog — they live in AgileBacklogPanel, not on the board.
const lanes = computed<ProjectColumn[]>(() => sortedColumns.value)

const rows = computed(() => buildAgileRows(groupStore.groupsOf(props.projectId), projectTasks.value))

const projectTasksByColumn = computed(() => groupTasksByColumn(projectTasks.value))

function laneTaskCount(lane: ProjectColumn): number {
  return projectTasksByColumn.value.get(lane.id)?.length ?? 0
}

async function handleToggleEpicDone(epic: BoardGroup) {
  await groupStore.toggleGroupDone(props.projectId, epic)
}

function handleTaskChange(event: any, columnId: string | null, groupId: string | null, cellTasks: Task[]) {
  onTaskChange(event, columnId, groupId, props.projectId, cellTasks)
}

watch(() => props.projectId, (id) => {
  if (id) {
    columnStore.fetchColumns(id)
    groupStore.fetchGroups(id)
  }
}, { immediate: true })
</script>

<template>
  <div v-if="columnStore.loading || groupStore.isLoading(projectId)" class="text-center py-8">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
  </div>
  <div v-else class="overflow-x-auto pb-4 h-full">
    <div class="grid" :style="{ gridTemplateColumns: `repeat(${lanes.length}, ${COLUMN_WIDTH_PX}px)` }">
      <div class="contents">
        <div
          v-for="lane in lanes"
          :key="lane.id"
          class="sticky top-0 z-10 bg-background border-b border-border px-3 py-2 flex items-center gap-2"
        >
          <div
            v-if="lane.color"
            class="w-2 h-2 rounded-full shrink-0"
            :style="{ backgroundColor: lane.color }"
          />
          <span class="text-sm font-medium truncate">{{ lane.title }}</span>
          <span class="text-xs text-muted-foreground shrink-0">{{ laneTaskCount(lane) }}</span>
        </div>
      </div>

      <template v-for="row in rows" :key="row.kind === 'epic' ? row.epic.id : 'ungrouped'">
        <AgileEpicBlock
          v-if="row.kind === 'epic'"
          :epic="row.epic"
          :stories="row.stories"
          :epic-tasks="row.epicTasks"
          :lanes="lanes"
          @toggle-task="$emit('toggleTask', $event)"
          @open-task="$emit('openTask', $event)"
          @toggle-done="handleToggleEpicDone(row.epic)"
          @task-change="handleTaskChange"
        />
        <div v-else class="col-span-full grid [grid-template-columns:subgrid] border-t-2 border-border">
          <div class="col-span-full px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Без эпика
          </div>
          <AgileCell
            v-for="lane in lanes"
            :key="lane.id"
            :tasks="groupTasksByColumn(row.tasks).get(lane.id) ?? []"
            :column-id="lane.id"
            :group-id="null"
            @toggle-task="$emit('toggleTask', $event)"
            @open-task="$emit('openTask', $event)"
            @task-change="handleTaskChange"
          />
        </div>
      </template>
    </div>
  </div>
</template>
