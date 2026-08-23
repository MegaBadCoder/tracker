<script setup lang="ts">
import type { AgileStoryRow } from '../lib/agile-layout'
import type { BoardGroupNode, ProjectColumn } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { groupTasksByColumn } from '../lib/agile-layout'
import AgileCell from './AgileCell.vue'
import AgileStoryBlock from './AgileStoryBlock.vue'

const props = defineProps<{
  epic: BoardGroupNode
  stories: AgileStoryRow[]
  epicTasks: Task[]
  lanes: ProjectColumn[]
}>()

defineEmits<{
  toggleTask: [id: string]
  openTask: [task: Task]
  toggleDone: []
  taskChange: [event: any, columnId: string | null, groupId: string | null, tasks: Task[]]
}>()

const collapsed = ref(false)

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
</script>

<template>
  <div
    class="col-span-full grid [grid-template-columns:subgrid] mt-3 bg-muted/15"
    :style="epicFrame"
  >
    <div class="col-span-full flex items-center gap-2 pl-4 pr-3 py-2 bg-muted/50">
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
      <span class="text-sm font-semibold truncate">{{ epic.title }}</span>
      <span class="text-xs text-muted-foreground shrink-0">{{ totalCount }}</span>
      <span class="text-xs text-muted-foreground shrink-0">{{ doneCount }} из {{ totalCount }} готово</span>
      <button
        class="ml-auto shrink-0 text-xs px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-[color,background-color,transform] duration-200 cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        @click="$emit('toggleDone')"
      >
        {{ epic.status === 'done' ? 'Открыть эпик' : 'Закрыть эпик' }}
      </button>
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
      />

      <!-- Задачи, висящие прямо на эпике. Без своей подписи они читались как
           задачи последней истории — интерфейс врал о том, где лежит задача.
           Пунктирный рейл и приглушённый курсив отличают этот ряд от истории. -->
      <div
        v-if="epicTasks.length > 0"
        class="col-span-full grid [grid-template-columns:subgrid] bg-muted/30"
        style="box-shadow: inset 2px 0 0 0 color-mix(in oklab, var(--muted-foreground) 40%, transparent)"
      >
        <div class="col-span-full flex items-center gap-2 pl-8 pr-3 py-1.5">
          <span class="text-xs italic text-muted-foreground/80 truncate">Задачи эпика</span>
          <span class="text-[11px] text-muted-foreground/60">{{ epicTasks.length }}</span>
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
