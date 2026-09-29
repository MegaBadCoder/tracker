<script setup lang="ts">
import type { BoardGroupNode, ProjectColumn } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { Plus } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { groupTasksByColumn } from '../lib/agile-layout'
import AgileCell from './AgileCell.vue'
import GroupActionsMenu from './GroupActionsMenu.vue'
import InlineTitleInput from './InlineTitleInput.vue'

const props = defineProps<{
  story: BoardGroupNode
  tasks: Task[]
  lanes: ProjectColumn[]
}>()

const emit = defineEmits<{
  toggleTask: [id: string]
  openTask: [task: Task]
  taskChange: [event: any, columnId: string | null, groupId: string | null, tasks: Task[]]
  openGroup: [id: string]
  renameGroup: [id: string, title: string]
  setGroupColor: [id: string, color: string | null]
  toggleGroupDone: [group: BoardGroupNode]
  deleteGroup: [group: BoardGroupNode]
  createTask: [groupId: string, title: string]
}>()

const tasksByColumn = computed(() => groupTasksByColumn(props.tasks))

const renaming = ref(false)
const addingTask = ref(false)

function commitRename(title: string) {
  renaming.value = false
  emit('renameGroup', props.story.id, title)
}

function handleCreateTask(title: string) {
  addingTask.value = false
  emit('createTask', props.story.id, title)
}
</script>

<template>
  <!-- Вложенность читается слоями, а не вдвинутым прямоугольником: отступ или
       margin на этом блоке сдвинул бы его subgrid-колонки относительно эпика
       и разломал сквозное выравнивание. Поэтому поверхность светлее эпика,
       рейл тоньше, подпись с отступом. -->
  <div
    class="col-span-full grid [grid-template-columns:subgrid] border-t border-border first:border-t-0"
  >
    <!-- Подпись — «хром» поверх панели эпика; область с карточками остаётся
         холстом, иначе карточке не на чем проступить. -->
    <div class="col-span-full flex items-center gap-2 pl-8 pr-3 py-1.5 bg-muted/35">
      <InlineTitleInput
        v-if="renaming"
        placeholder="Название истории"
        :initial="story.title"
        class="flex-1 min-w-0"
        @submit="commitRename"
        @cancel="renaming = false"
      />
      <!-- Один кегль с названием задачи, поэтому разводим яркостью:
           содержимое светлое, подпись-разделитель приглушённая. -->
      <button
        v-else
        class="text-xs font-medium text-muted-foreground truncate hover:text-foreground hover:underline cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        @click="$emit('openGroup', story.id)"
      >
        {{ story.title }}
      </button>
      <span class="text-[11px] text-muted-foreground/60 shrink-0">{{ tasks.length }}</span>
      <div class="flex items-center gap-0.5 shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          class="text-muted-foreground hover:text-foreground"
          aria-label="Добавить задачу в историю"
          @click="addingTask = true"
        >
          <Plus :size="14" />
        </Button>
        <GroupActionsMenu
          :group="story"
          @open="$emit('openGroup', story.id)"
          @rename="renaming = true"
          @set-color="(color) => $emit('setGroupColor', story.id, color)"
          @toggle-done="$emit('toggleGroupDone', story)"
          @delete="$emit('deleteGroup', story)"
        />
      </div>
    </div>
    <div v-if="addingTask" class="col-span-full pl-8 pr-3 py-1.5 bg-muted/35">
      <InlineTitleInput
        placeholder="Название задачи"
        @submit="handleCreateTask"
        @cancel="addingTask = false"
      />
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
