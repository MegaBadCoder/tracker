<script setup lang="ts">
import type { Task } from '@/features/tasks/model/types'
import draggable from 'vuedraggable'
import TaskCard from '@/features/tasks/ui/TaskCard.vue'

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

function handleChange(event: any) {
  emit('taskChange', event, props.columnId, props.groupId, props.tasks)
}
</script>

<template>
  <div class="min-h-10 px-1.5 py-1.5 border-l border-border/50 first:border-l-0">
    <draggable
      :model-value="tasks"
      item-key="id"
      :group="{ name: 'agile-tasks' }"
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
</template>
