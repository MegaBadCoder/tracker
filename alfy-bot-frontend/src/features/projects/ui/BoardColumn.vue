<template>
  <div class="shrink-0 w-72 flex flex-col bg-muted/30 rounded-lg max-h-full">
    <BoardColumnHeader
      :column="column"
      :task-count="tasks.length"
      @rename="handleRename"
      @delete="$emit('deleteColumn')"
    />
    <div class="flex-1 overflow-y-auto px-1.5 pb-1.5 min-h-[40px]">
      <draggable
        :model-value="tasks"
        item-key="id"
        group="tasks"
        :animation="150"
        ghost-class="opacity-30"
        class="space-y-1 min-h-[20px]"
        @change="handleChange"
      >
        <template #item="{ element }">
          <TaskCard
            :task="element"
            variant="compact"
            @toggle="$emit('toggleTask', $event)"
            @open="$emit('openTask', $event)"
          />
        </template>
      </draggable>
    </div>
  </div>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'
import TaskCard from '@/features/tasks/ui/TaskCard.vue'
import BoardColumnHeader from './BoardColumnHeader.vue'
import type { ProjectColumn } from '../model/types'
import type { Task } from '@/features/tasks/model/types'

const props = defineProps<{
  column: ProjectColumn | null
  tasks: Task[]
  projectId: string
}>()

const emit = defineEmits<{
  taskChange: [event: any, columnId: string | null, tasks: Task[]]
  toggleTask: [id: string]
  openTask: [task: Task]
  deleteColumn: []
  renameColumn: [title: string]
}>()

function handleChange(event: any) {
  emit('taskChange', event, props.column?.id ?? null, props.tasks)
}

function handleRename(title: string) {
  emit('renameColumn', title)
}
</script>
