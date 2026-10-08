<script setup lang="ts">
import type { AgileEpicRow, AgileUngroupedRow } from '../lib/agile-layout'
import type { BoardGroupNode, ProjectColumn } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { Plus } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { buildAgileRows, groupTasksByColumn } from '../lib/agile-layout'
import { useAgileDnd } from '../lib/use-agile-dnd'
import { useGroupDeletion } from '../lib/use-group-deletion'
import { useColumnStore } from '../model/column-store'
import { useGroupStore } from '../model/group-store'
import { useSprintStore } from '../model/sprint-store'
import { useGroupDetail } from '../model/use-group-detail'
import AgileCell from './AgileCell.vue'
import AgileEpicBlock from './AgileEpicBlock.vue'
import InlineTitleInput from './InlineTitleInput.vue'

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
const sprintStore = useSprintStore()
const taskStore = useTaskStore()
const { tasks } = storeToRefs(taskStore)
const { onTaskChange } = useAgileDnd(taskStore)
const { deleteGroupWithConfirm } = useGroupDeletion()
const groupDetail = useGroupDetail()

const addingEpic = ref(false)

const sortedColumns = computed(() =>
  [...columnStore.columns].sort((a, b) => a.order - b.order),
)

const activeSprint = computed(() => sprintStore.activeSprintOf(props.projectId))

const sprintBoardTasks = computed(() => {
  const sprintId = activeSprint.value?.id
  if (!sprintId)
    return []
  return tasks.value.filter(t => t.projectId === props.projectId && t.sprintId === sprintId)
})

const projectTasks = computed(() =>
  sprintBoardTasks.value.filter(t =>
    (props.showCompleted || !t.completed)
    && (!props.hideOverdue || !t.isOverdue),
  ),
)

const lanes = computed<ProjectColumn[]>(() => sortedColumns.value)

const rows = computed(() => buildAgileRows(groupStore.groupsOf(props.projectId), projectTasks.value))

const epicRows = computed(() =>
  rows.value.filter((row): row is AgileEpicRow => row.kind === 'epic'),
)

const ungroupedRow = computed(() =>
  rows.value.find((row): row is AgileUngroupedRow => row.kind === 'ungrouped'),
)

const ungroupedTasksByColumn = computed(() => groupTasksByColumn(ungroupedRow.value?.tasks ?? []))

const projectTasksByColumn = computed(() => groupTasksByColumn(projectTasks.value))

function laneTaskCount(lane: ProjectColumn): number {
  return projectTasksByColumn.value.get(lane.id)?.length ?? 0
}

async function handleToggleGroupDone(group: BoardGroupNode) {
  await groupStore.toggleGroupDone(props.projectId, group)
}

function handleOpenGroup(id: string) {
  groupDetail.open(props.projectId, id)
}

async function handleRenameGroup(id: string, title: string) {
  await groupStore.updateGroup(props.projectId, id, { title })
}

async function handleSetGroupColor(id: string, color: string | null) {
  await groupStore.updateGroup(props.projectId, id, { color })
}

async function handleCreateStory(epicId: string, title: string) {
  await groupStore.createGroup(props.projectId, { title, parentId: epicId })
}

async function handleCreateEpic(title: string) {
  addingEpic.value = false
  await groupStore.createGroup(props.projectId, { title })
}

async function handleCreateTask(groupId: string, title: string) {
  const sprint = activeSprint.value
  if (!sprint)
    throw new Error('Нет активного спринта для новой задачи')

  await taskStore.createTask({
    title,
    completed: false,
    projectId: props.projectId,
    columnId: lanes.value[0]?.id ?? null,
    sprintId: sprint.id,
    groupId,
  })
}

async function handleDeleteGroup(group: BoardGroupNode) {
  await deleteGroupWithConfirm(props.projectId, group)
}

function handleTaskChange(event: any, columnId: string, groupId: string | null, cellTasks: Task[]) {
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

      <AgileEpicBlock
        v-for="row in epicRows"
        :key="row.epic.id"
        :epic="row.epic"
        :stories="row.stories"
        :epic-tasks="row.epicTasks"
        :lanes="lanes"
        @toggle-task="$emit('toggleTask', $event)"
        @open-task="$emit('openTask', $event)"
        @task-change="handleTaskChange"
        @open-group="handleOpenGroup"
        @rename-group="handleRenameGroup"
        @set-group-color="handleSetGroupColor"
        @create-story="handleCreateStory"
        @toggle-group-done="handleToggleGroupDone"
        @delete-group="handleDeleteGroup"
        @create-task="handleCreateTask"
      />

      <div class="col-span-full grid [grid-template-columns:subgrid]">
        <div class="col-span-full px-3 py-2">
          <button
            v-if="!addingEpic"
            class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            @click="addingEpic = true"
          >
            <Plus :size="14" />
            Эпик
          </button>
          <InlineTitleInput
            v-else
            placeholder="Название эпика"
            @submit="handleCreateEpic"
            @cancel="addingEpic = false"
          />
        </div>
      </div>

      <div class="col-span-full grid [grid-template-columns:subgrid] border-t-2 border-border">
        <div class="col-span-full px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Без эпика
        </div>
        <AgileCell
          v-for="lane in lanes"
          :key="lane.id"
          :tasks="ungroupedTasksByColumn.get(lane.id) ?? []"
          :column-id="lane.id"
          :group-id="null"
          @toggle-task="$emit('toggleTask', $event)"
          @open-task="$emit('openTask', $event)"
          @task-change="handleTaskChange"
        />
      </div>
    </div>
  </div>
</template>
