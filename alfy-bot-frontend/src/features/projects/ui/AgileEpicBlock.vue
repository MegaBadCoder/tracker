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
  lanes: Array<ProjectColumn | null>
}>()

defineEmits<{
  toggleTask: [id: string]
  openTask: [task: Task]
  toggleDone: []
}>()

const collapsed = ref(false)

const allEpicTasks = computed(() => [
  ...props.epicTasks,
  ...props.stories.flatMap(s => s.tasks),
])

const totalCount = computed(() => allEpicTasks.value.length)
const doneCount = computed(() => allEpicTasks.value.filter(t => t.completed).length)

const epicTasksByColumn = computed(() => groupTasksByColumn(props.epicTasks))
</script>

<template>
  <div class="col-span-full grid [grid-template-columns:subgrid] border-t-2 border-border">
    <div class="col-span-full flex items-center gap-2 px-3 py-2 bg-muted/40">
      <button
        class="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        :aria-label="collapsed ? 'Развернуть эпик' : 'Свернуть эпик'"
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
        class="ml-auto shrink-0 text-xs px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
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
      />

      <div v-if="epicTasks.length > 0" class="col-span-full grid [grid-template-columns:subgrid] border-t border-border/60">
        <AgileCell
          v-for="lane in lanes"
          :key="lane?.id ?? 'uncategorized'"
          :tasks="epicTasksByColumn.get(lane ? lane.id : null) ?? []"
          @toggle-task="$emit('toggleTask', $event)"
          @open-task="$emit('openTask', $event)"
        />
      </div>
    </template>
  </div>
</template>
