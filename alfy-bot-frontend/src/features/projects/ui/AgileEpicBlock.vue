<script setup lang="ts">
import type { AgileStoryRow } from '../lib/agile-layout'
import type { BoardGroupNode, ProjectColumn } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { ChevronDown, ChevronRight, Plus } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { groupTasksByColumn } from '../lib/agile-layout'
import AgileCell from './AgileCell.vue'
import AgileStoryBlock from './AgileStoryBlock.vue'
import GroupActionsMenu from './GroupActionsMenu.vue'
import InlineTitleInput from './InlineTitleInput.vue'

const props = defineProps<{
  epic: BoardGroupNode
  stories: AgileStoryRow[]
  epicTasks: Task[]
  lanes: ProjectColumn[]
}>()

const emit = defineEmits<{
  toggleTask: [id: string]
  openTask: [task: Task]
  taskChange: [event: any, columnId: string | null, groupId: string | null, tasks: Task[]]
  openGroup: [id: string]
  renameGroup: [id: string, title: string]
  setGroupColor: [id: string, color: string | null]
  createStory: [epicId: string, title: string]
  toggleGroupDone: [group: BoardGroupNode]
  deleteGroup: [group: BoardGroupNode]
  createTask: [groupId: string, title: string]
}>()

const collapsed = ref(false)
const renaming = ref(false)
const addingEpicTask = ref(false)
const addingStory = ref(false)

const allEpicTasks = computed(() => [
  ...props.epicTasks,
  ...props.stories.flatMap(s => s.tasks),
])

const totalCount = computed(() => allEpicTasks.value.length)
const doneCount = computed(() => allEpicTasks.value.filter(t => t.completed).length)

const epicTasksByColumn = computed(() => groupTasksByColumn(props.epicTasks))

// Рамка рисуется inset-тенью, а не border/padding: тень не занимает места,
// поэтому subgrid-колонки эпика остаются на одной вертикали с колонками доски.
// Любой отступ на этом блоке сдвинул бы его дорожки относительно заголовков.
const epicFrame = computed(() => ({
  boxShadow: `inset 3px 0 0 0 ${props.epic.color || 'var(--primary)'}, inset 0 0 0 1px color-mix(in oklab, var(--border) 70%, transparent)`,
}))

function commitRename(title: string) {
  renaming.value = false
  emit('renameGroup', props.epic.id, title)
}

function startAddingEpicTask() {
  collapsed.value = false
  addingEpicTask.value = true
}

function handleCreateEpicTask(title: string) {
  addingEpicTask.value = false
  emit('createTask', props.epic.id, title)
}

function startAddingStory() {
  collapsed.value = false
  addingStory.value = true
}

function handleCreateStory(title: string) {
  addingStory.value = false
  emit('createStory', props.epic.id, title)
}
</script>

<template>
  <div
    class="col-span-full grid [grid-template-columns:subgrid] mt-4 rounded-lg overflow-hidden bg-muted/20"
    :style="epicFrame"
  >
    <div class="col-span-full flex items-center gap-2 pl-4 pr-3 py-2.5 bg-muted/60">
      <button
        class="shrink-0 -m-1.5 p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :aria-label="collapsed ? 'Развернуть эпик' : 'Свернуть эпик'"
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
      >
        <ChevronRight v-if="collapsed" :size="16" />
        <ChevronDown v-else :size="16" />
      </button>
      <div
        v-if="epic.color"
        class="w-2.5 h-2.5 rounded-full shrink-0"
        :style="{ backgroundColor: epic.color }"
      />
      <InlineTitleInput
        v-if="renaming"
        placeholder="Название эпика"
        :initial="epic.title"
        class="flex-1 min-w-0"
        @submit="commitRename"
        @cancel="renaming = false"
      />
      <button
        v-else
        class="text-sm font-semibold truncate hover:underline cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        @click="$emit('openGroup', epic.id)"
      >
        {{ epic.title }}
      </button>
      <span class="text-xs text-muted-foreground shrink-0">{{ totalCount }}</span>
      <span class="text-xs text-muted-foreground shrink-0">{{ doneCount }} из {{ totalCount }} готово</span>
      <div class="flex items-center gap-0.5 shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          class="text-muted-foreground hover:text-foreground"
          aria-label="Добавить задачу в эпик"
          @click="startAddingEpicTask"
        >
          <Plus :size="16" />
        </Button>
        <GroupActionsMenu
          :group="epic"
          @open="$emit('openGroup', epic.id)"
          @rename="renaming = true"
          @set-color="(color) => $emit('setGroupColor', epic.id, color)"
          @add-story="startAddingStory"
          @toggle-done="$emit('toggleGroupDone', epic)"
          @delete="$emit('deleteGroup', epic)"
        />
      </div>
    </div>

    <template v-if="!collapsed">
      <AgileStoryBlock
        v-for="storyRow in stories"
        :key="storyRow.story.id"
        :story="storyRow.story"
        :tasks="storyRow.tasks"
        :lanes="lanes"
        @toggle-task="$emit('toggleTask', $event)"
        @open-task="$emit('openTask', $event)"
        @task-change="(...args) => $emit('taskChange', ...args)"
        @open-group="$emit('openGroup', $event)"
        @rename-group="(id, title) => $emit('renameGroup', id, title)"
        @set-group-color="(id, color) => $emit('setGroupColor', id, color)"
        @toggle-group-done="$emit('toggleGroupDone', $event)"
        @delete-group="$emit('deleteGroup', $event)"
        @create-task="(groupId, title) => $emit('createTask', groupId, title)"
      />

      <div
        v-if="addingStory"
        class="col-span-full grid [grid-template-columns:subgrid] border-t border-border"
      >
        <div class="col-span-full pl-8 pr-3 py-1.5">
          <InlineTitleInput
            placeholder="Название истории"
            @submit="handleCreateStory"
            @cancel="addingStory = false"
          />
        </div>
      </div>

      <!-- Задачи, висящие прямо на эпике. Без своей подписи они читались как
           задачи последней истории — интерфейс врал о том, где лежит задача.
           Пунктирный рейл и приглушённый курсив отличают этот ряд от истории. -->
      <div
        v-if="epicTasks.length > 0 || addingEpicTask"
        class="col-span-full grid [grid-template-columns:subgrid] border-t border-border"
      >
        <div class="col-span-full flex items-center gap-2 pl-8 pr-3 py-1.5 bg-muted/25">
          <span class="text-xs italic text-muted-foreground/80 truncate">Задачи эпика</span>
          <span class="text-[11px] text-muted-foreground/60">{{ epicTasks.length }}</span>
        </div>
        <div v-if="addingEpicTask" class="col-span-full pl-8 pr-3 py-1.5 bg-muted/25">
          <InlineTitleInput
            placeholder="Название задачи"
            @submit="handleCreateEpicTask"
            @cancel="addingEpicTask = false"
          />
        </div>
        <AgileCell
          v-for="lane in lanes"
          :key="lane.id"
          :tasks="epicTasksByColumn.get(lane.id) ?? []"
          :column-id="lane.id"
          :group-id="epic.id"
          @toggle-task="$emit('toggleTask', $event)"
          @open-task="$emit('openTask', $event)"
          @task-change="(...args) => $emit('taskChange', ...args)"
        />
      </div>
    </template>
  </div>
</template>
