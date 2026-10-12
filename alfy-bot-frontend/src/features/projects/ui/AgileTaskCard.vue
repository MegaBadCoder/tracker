<script setup lang="ts">
import type { Task } from '@/features/tasks/model/types'
import { Calendar, CheckSquare, Flag } from 'lucide-vue-next'
import { computed } from 'vue'
import { computeChecklistProgress } from '@/features/tasks/lib/checklist'
import { DATE_SHORT, formatDate } from '@/features/tasks/lib/formatters'
import { getPriorityColor } from '@/features/tasks/lib/priority'
import { PRIORITY_LABELS } from '@/features/tasks/model/constants'
import { taskKey } from '../lib/task-key'
import { useProjectStore } from '../model/project-store'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ open: [task: Task] }>()
const projects = useProjectStore()
const key = computed(() => taskKey(props.task.projectId ? projects.projectMap.get(props.task.projectId) : undefined, props.task))
const checklist = computed(() => computeChecklistProgress(props.task.checklist?.items ?? []))
</script>

<template>
  <button
    type="button"
    :data-task-id="task.id"
    class="agile-task-card flex min-h-[100px] w-full flex-col gap-2 rounded-[3px] bg-card p-3 text-left shadow-sm cursor-grab select-none transition-[background-color,box-shadow] duration-150 active:cursor-grabbing hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    :aria-label="[key, task.title].filter(Boolean).join(': ')"
    @click="emit('open', task)"
  >
    <span v-if="key" data-testid="task-key" class="text-xs font-semibold text-muted-foreground">{{ key }}</span>
    <span class="w-full whitespace-normal break-words text-sm font-medium leading-snug">{{ task.title }}</span>
    <span class="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
      <span v-if="task.completed" class="inline-flex items-center gap-1 rounded-md bg-green-500/10 px-2 py-0.5 font-medium text-green-700 dark:bg-green-500/15 dark:text-green-400">
        Выполнено
      </span>
      <span v-if="task.priority" class="inline-flex items-center gap-1" :title="PRIORITY_LABELS[task.priority]">
        <Flag :size="12" :class="getPriorityColor(task.priority)" aria-hidden="true" />{{ PRIORITY_LABELS[task.priority] }}
      </span>
      <span v-if="task.dueDate" class="inline-flex items-center gap-1">
        <Calendar :size="12" aria-hidden="true" />{{ formatDate(task.dueDate, DATE_SHORT) }}
      </span>
      <span v-if="checklist.total" class="inline-flex items-center gap-1">
        <CheckSquare :size="12" aria-hidden="true" />{{ checklist.completed }}/{{ checklist.total }}
      </span>
      <span v-if="task.isOverdue" class="text-destructive">Просрочена</span>
      <span v-for="tag in task.tags?.slice(0, 2)" :key="tag" class="rounded bg-muted px-1.5 py-0.5">{{ tag }}</span>
    </span>
  </button>
</template>

<style scoped>
@media (hover: hover) and (pointer: fine) {
  .agile-task-card:hover {
    background-color: color-mix(in oklab, var(--card), var(--foreground) 7%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .agile-task-card {
    transition: none;
  }
}
</style>
