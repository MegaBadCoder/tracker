<script setup lang="ts">
import type { Task } from '@/features/tasks/model/types'
import TaskCard from '@/features/tasks/ui/TaskCard.vue'

defineProps<{
  tasks: Task[]
}>()

defineEmits<{
  toggleTask: [id: string]
  openTask: [task: Task]
}>()
</script>

<template>
  <div class="min-h-10 px-1.5 py-1.5 space-y-1 border-l border-border/50 first:border-l-0">
    <TaskCard
      v-for="task in tasks"
      :key="task.id"
      :task="task"
      variant="compact"
      @toggle="$emit('toggleTask', $event)"
      @open="$emit('openTask', $event)"
    />
  </div>
</template>
