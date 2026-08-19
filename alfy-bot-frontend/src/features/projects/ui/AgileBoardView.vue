<script setup lang="ts">
import type { BoardGroup, ProjectColumn } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { buildAgileRows, groupTasksByColumn } from '../lib/agile-layout'
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

const hasUncategorizedTasks = computed(() =>
  projectTasks.value.some(t => !t.columnId),
)

// Leading "no column" lane (per BoardView's null-column precedent), followed
// by the project's real columns in order. Only present when there are tasks
// with columnId === null — otherwise the lane is not rendered at all.
const lanes = computed<Array<ProjectColumn | null>>(() =>
  hasUncategorizedTasks.value ? [null, ...sortedColumns.value] : sortedColumns.value,
)

const rows = computed(() => buildAgileRows(groupStore.groups, projectTasks.value))

const projectTasksByColumn = computed(() => groupTasksByColumn(projectTasks.value))

function laneTaskCount(lane: ProjectColumn | null): number {
  return projectTasksByColumn.value.get(lane ? lane.id : null)?.length ?? 0
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
    <div class="grid" :style="{ gridTemplateColumns: `repeat(${lanes.length}, ${COLUMN_WIDTH_PX}px)` }">
      <div class="contents">
        <div
          v-for="lane in lanes"
          :key="lane?.id ?? 'uncategorized'"
          class="sticky top-0 z-10 bg-background border-b border-border px-3 py-2 flex items-center gap-2"
        >
          <template v-if="lane">
            <div
              v-if="lane.color"
              class="w-2 h-2 rounded-full shrink-0"
              :style="{ backgroundColor: lane.color }"
            />
            <span class="text-sm font-medium truncate">{{ lane.title }}</span>
          </template>
          <span v-else class="text-sm font-medium truncate">Без колонки</span>
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
        />
        <div v-else class="col-span-full grid [grid-template-columns:subgrid] border-t-2 border-border">
          <div class="col-span-full px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Без эпика
          </div>
          <AgileCell
            v-for="lane in lanes"
            :key="lane?.id ?? 'uncategorized'"
            :tasks="groupTasksByColumn(row.tasks).get(lane ? lane.id : null) ?? []"
            @toggle-task="$emit('toggleTask', $event)"
            @open-task="$emit('openTask', $event)"
          />
        </div>
      </template>
    </div>
  </div>
</template>
