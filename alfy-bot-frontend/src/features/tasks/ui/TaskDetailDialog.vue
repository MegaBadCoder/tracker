<script setup lang="ts">
import type { ChecklistItem, Task } from '../model/types'
import { useMediaQuery } from '@vueuse/core'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import TaskDetailContent from './TaskDetailContent.vue'

withDefaults(defineProps<{
  task: Task | null
  open: boolean
  editable?: boolean
  autofocusTitle?: boolean
}>(), {
  editable: true,
  autofocusTitle: false,
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'delete', id: string): void
  (e: 'update', task: Task): void
  (e: 'update:checklist', taskId: string, items: ChecklistItem[]): void
  (e: 'update:pomodoroConfig', taskId: string, config: {
    pomodoroCount: number
    pomodoroDuration: number
    shortBreak: number
    longBreak: number
    longBreakInterval: number
  } | null): void
}>()

const isDesktop = useMediaQuery('(min-width: 640px)')
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      :aria-describedby="undefined"
      class="flex flex-col gap-0 p-0 overflow-hidden [&>button:last-child]:hidden" :class="[
        isDesktop
          ? 'max-w-3xl h-[95dvh]'
          : 'inset-0 h-[100dvh] w-full max-w-none rounded-none translate-x-0 translate-y-0 left-0 top-0 border-0',
      ]"
    >
      <DialogTitle class="sr-only">
        {{ task?.title || 'Задача' }}
      </DialogTitle>
      <TaskDetailContent
        :task="task"
        :open="open"
        :editable="editable"
        :autofocus-title="autofocusTitle"
        presentation="preview"
        @update:open="emit('update:open', $event)"
        @update="emit('update', $event)"
        @delete="emit('delete', $event)"
        @update:checklist="(id, items) => emit('update:checklist', id, items)"
        @update:pomodoro-config="(id, config) => emit('update:pomodoroConfig', id, config)"
      />
    </DialogContent>
  </Dialog>
</template>
