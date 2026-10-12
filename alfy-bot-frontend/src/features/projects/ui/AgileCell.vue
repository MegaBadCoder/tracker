<script setup lang="ts">
import type { Task } from '@/features/tasks/model/types'
import draggable from 'vuedraggable'
import AgileTaskCard from './AgileTaskCard.vue'

const props = defineProps<{
  tasks: Task[]
  columnId: string
  groupId: string | null
}>()

const emit = defineEmits<{
  toggleTask: [id: string]
  openTask: [task: Task]
  taskChange: [event: any, columnId: string, groupId: string | null, tasks: Task[]]
}>()

function handleChange(event: any) {
  emit('taskChange', event, props.columnId, props.groupId, props.tasks)
}
</script>

<template>
  <div class="flex min-h-[88px] flex-col bg-muted/30 p-1.5">
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
    >
      <template #item="{ element }">
        <AgileTaskCard
          :task="element"
          @open="$emit('openTask', $event)"
        />
      </template>
    </draggable>
  </div>
</template>
