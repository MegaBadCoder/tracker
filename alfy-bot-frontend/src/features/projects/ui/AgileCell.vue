<script setup lang="ts">
import type { Task } from '@/features/tasks/model/types'
import draggable from 'vuedraggable'
import TaskCard from '@/features/tasks/ui/TaskCard.vue'
import { alog } from '../lib/agile-debug'

const props = defineProps<{
  tasks: Task[]
  columnId: string | null
  groupId: string | null
}>()

const emit = defineEmits<{
  toggleTask: [id: string]
  openTask: [task: Task]
  taskChange: [event: any, columnId: string | null, groupId: string | null, tasks: Task[]]
}>()

function cellId() {
  return { columnId: props.columnId, groupId: props.groupId }
}

function handleChange(event: any) {
  alog('3. cell change', { cell: cellId(), kinds: Object.keys(event) })
  emit('taskChange', event, props.columnId, props.groupId, props.tasks)
}

function handleStart(event: any) {
  alog('1. sortable start (перетаскивание началось)', {
    fromCell: cellId(),
    index: event?.oldIndex,
  })
}

function handleEnd(event: any) {
  alog('2. sortable end (отпустили)', {
    fromCell: cellId(),
    oldIndex: event?.oldIndex,
    newIndex: event?.newIndex,
    sameList: event?.from === event?.to,
  })
}
</script>

<template>
  <div class="flex min-h-10 flex-col px-1.5 py-1.5 border-l border-border/50 first:border-l-0">
    <!-- flex-1 обязателен: без него список принимает drop только на высоту
         своего содержимого, и в пустой ячейке это полоска в 20px посреди
         88px — карточка отскакивает назад, а выглядит как «не переносится». -->
    <draggable
      :model-value="tasks"
      item-key="id"
      :group="{ name: 'agile-tasks' }"
      :animation="150"
      ghost-class="opacity-30"
      class="flex-1 space-y-1 min-h-[20px]"
      @change="handleChange"
      @start="handleStart"
      @end="handleEnd"
    >
      <template #item="{ element }">
        <TaskCard
          :task="element"
          variant="compact"
          :dnd-source="false"
          @toggle="$emit('toggleTask', $event)"
          @open="$emit('openTask', $event)"
        />
      </template>
    </draggable>
  </div>
</template>
