<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { Play } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useNow } from '@/composables/useNow'
import { toTimerTask, useTimerStore } from '@/features/task-timer'
import { getActiveTasksAt, getTaskProgressAt, type TaskProgress } from '../lib/active-tasks'
import { formatPomodoro, formatRemaining } from '../lib/formatters'
import type { Task } from '../model/types'
import { useTaskStore } from '../model/task-store'

interface ActiveRow {
  task: Task
  progress: TaskProgress
}

const { tasks } = storeToRefs(useTaskStore())
const timerStore = useTimerStore()
const now = useNow()

const rows = computed<ActiveRow[]>(() =>
  getActiveTasksAt(tasks.value, now.value)
    .map(task => ({ task, progress: getTaskProgressAt(task, now.value) }))
    .filter((row): row is ActiveRow => row.progress !== null),
)

function pomodoroLabel(task: Task): string | null {
  if (!task.isPomodoroTask) return null
  return `${formatPomodoro(task.pomodoroCompleted || 0)}/${task.pomodoroCount || 0}`
}
</script>

<template>
  <div v-if="rows.length" class="px-4 mt-4">
    <span class="text-[11px] font-medium text-sidebar-foreground/60 uppercase tracking-wide">
      Идёт сейчас
    </span>

    <div class="flex flex-col gap-2 mt-1.5">
      <div
        v-for="{ task, progress } in rows"
        :key="task.id"
        class="relative overflow-hidden rounded-md border border-sidebar-border bg-sidebar-accent/60 pl-3 pr-2 py-2 transition-colors duration-200 hover:bg-sidebar-accent"
      >
        <!-- Живая полоса слева: эхо линии текущего времени в календаре -->
        <span class="absolute left-0 inset-y-0 w-[3px] bg-primary" aria-hidden="true" />

        <div class="flex items-center gap-1">
          <span class="truncate flex-1 text-sm font-medium leading-tight">{{ task.title }}</span>
          <Button
            v-if="task.isPomodoroTask"
            variant="ghost"
            size="icon-sm"
            class="relative shrink-0 text-red-500 hover:text-red-500 hover:bg-red-500/10 cursor-pointer before:absolute before:-inset-1.5 before:content-['']"
            :aria-label="`Запустить помодоро: ${task.title}`"
            @click="timerStore.startTask(toTimerTask(task))"
          >
            <Play :size="14" />
          </Button>
        </div>

        <div class="mt-0.5 text-[11px] text-sidebar-foreground/60 tabular-nums">
          осталось {{ formatRemaining(progress.remainingMinutes) }}
          <template v-if="pomodoroLabel(task)">
            · {{ pomodoroLabel(task) }}
          </template>
        </div>

        <!-- Прогресс дублирует текст выше, поэтому скрыт от скринридеров -->
        <div class="mt-1.5 h-[3px] rounded-full bg-sidebar-foreground/15" aria-hidden="true">
          <div
            class="h-full rounded-full bg-primary transition-[width] duration-500 ease-linear motion-reduce:transition-none"
            :style="{ width: `${Math.round(progress.ratio * 100)}%` }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
