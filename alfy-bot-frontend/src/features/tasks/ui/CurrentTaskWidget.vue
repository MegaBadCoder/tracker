<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { Play } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useNow } from '@/composables/useNow'
import { toTimerTask, useTimerStore } from '@/features/task-timer'
import { getActiveTasksAt } from '../lib/active-tasks'
import { useTaskStore } from '../model/task-store'

const { tasks } = storeToRefs(useTaskStore())
const timerStore = useTimerStore()
const now = useNow()

const activeTasks = computed(() => getActiveTasksAt(tasks.value, now.value))
</script>

<template>
  <div v-if="activeTasks.length" class="px-4 mt-4">
    <span class="text-[11px] font-medium text-sidebar-foreground/60 uppercase tracking-wide">
      Текущая задача
    </span>
    <div class="flex flex-col gap-0.5 mt-1">
      <div
        v-for="task in activeTasks"
        :key="task.id"
        class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-sidebar-accent/40"
      >
        <span class="truncate flex-1">{{ task.title }}</span>
        <Button
          v-if="task.isPomodoroTask"
          variant="ghost"
          size="icon-sm"
          class="shrink-0"
          :aria-label="`Запустить помодоро: ${task.title}`"
          @click="timerStore.startTask(toTimerTask(task))"
        >
          <Play :size="14" class="text-red-500" />
        </Button>
      </div>
    </div>
  </div>
</template>
