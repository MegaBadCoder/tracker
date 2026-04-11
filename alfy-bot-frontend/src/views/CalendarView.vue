<template>
  <div class="flex flex-col h-[100dvh]">
    <AppHeader title="Календарь" :on-menu-click="openSidebar" fluid />
    <main class="flex-1 min-h-0 px-4 py-2 pb-4">
      <WeeklyCalendar class="h-full" @open-task="handleOpenTask" />
    </main>
  </div>
  <TaskDetailDialog
    :task="selectedTask"
    :open="isDetailOpen"
    @update:open="isDetailOpen = $event"
    @delete="handleDeleteFromDialog"
    @update="handleUpdateTask"
    @update:checklist="handleUpdateChecklist"
    @update:pomodoro-config="handleUpdatePomodoroConfig"
  />
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { WeeklyCalendar } from '@/features/calendar'
import AppHeader from '@/components/AppHeader.vue'
import TaskDetailDialog from '@/features/tasks/ui/TaskDetailDialog.vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { useConfirm } from '@/composables/useConfirm'
import { useTaskDetailHandlers } from '@/features/tasks/lib/use-task-detail-handlers'

const openSidebar = inject<() => void>('openSidebar', () => {})

const taskStore = useTaskStore()
const { confirm } = useConfirm()

const {
  selectedTask,
  isDetailOpen,
  handleOpenTask,
  handleUpdateTask,
  handleUpdateChecklist,
  handleUpdatePomodoroConfig,
  handleDeleteFromDialog,
} = useTaskDetailHandlers(taskStore, confirm)
</script>
