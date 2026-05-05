<script setup lang="ts">
import type { Task } from '@/features/tasks/model/types'
import { storeToRefs } from 'pinia'
import { computed, inject, onMounted, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import PageContainer from '@/components/PageContainer.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useProjectStore } from '@/features/projects/model/project-store'
import { useTimerStore } from '@/features/task-timer'
import { useHideOverdue } from '@/features/tasks/lib/use-hide-overdue'
import { useShowCompleted } from '@/features/tasks/lib/use-show-completed'
import { useTaskDetailHandlers } from '@/features/tasks/lib/use-task-detail-handlers'
import { useTaskStore } from '@/features/tasks/model/task-store'
import TaskCard from '@/features/tasks/ui/TaskCard.vue'
import TaskDetailDialog from '@/features/tasks/ui/TaskDetailDialog.vue'
import TaskForm from '@/features/tasks/ui/TaskForm.vue'
import TaskListOptionsMenu from '@/features/tasks/ui/TaskListOptionsMenu.vue'

const openSidebar = inject<() => void>('openSidebar')

const timerStore = useTimerStore()
const { startTask } = timerStore
const taskFormRef = ref<InstanceType<typeof TaskForm> | null>(null)
const isCreatingTask = ref(false)

const taskStore = useTaskStore()
const { tasks, loading, error } = storeToRefs(taskStore)
const {
  fetchTasks,
  createTask,
  toggleTask,
  deleteTask,
} = taskStore

const projectStore = useProjectStore()

const { confirm } = useConfirm()

const showCompleted = useShowCompleted('inbox')
const hideOverdue = useHideOverdue('inbox')

function getProjectName(task: Task) {
  if (!task.projectId)
    return undefined
  return projectStore.projectMap.get(task.projectId)?.title
}

const {
  selectedTask,
  isDetailOpen,
  handleOpenTask,
  handleUpdateTask,
  handleUpdateChecklist,
  handleUpdatePomodoroConfig,
  handleDeleteFromDialog,
} = useTaskDetailHandlers(taskStore, confirm)

const sortedTasks = computed(() => {
  return [...tasks.value]
    .filter(t => !t.projectId)
    .filter(t => showCompleted.value || !t.completed)
    .filter(t => !hideOverdue.value || !t.isOverdue)
    .sort((a, b) => {
      const w = (t: Task) => (t.isOverdue ? 2 : 0) + (t.completed ? 1 : 0)
      return w(a) - w(b)
    })
})

async function handleAddTask(taskData: Omit<Task, 'id' | 'pomodoroCompleted'>) {
  isCreatingTask.value = true
  try {
    await createTask(taskData)
    taskFormRef.value?.resetForm()
  }
  catch (err) {
    console.error('Ошибка добавления задачи:', err)
  }
  finally {
    isCreatingTask.value = false
  }
}

async function handleToggleTask(taskId: string) {
  try {
    await toggleTask(taskId)
  }
  catch (err) {
    console.error('Ошибка обновления задачи:', err)
  }
}

function handleShowTimer(taskId: string) {
  const task = tasks.value.find(t => t.id === taskId)
  if (!task?.isPomodoroTask)
    return

  startTask({
    id: task.id,
    pomodoroTime: task.pomodoroDuration || 25,
    breakTime: task.shortBreak || 5,
    longBreakTime: task.longBreak || 15,
    longBreakInterval: task.longBreakInterval || 4,
    pomodoroCount: task.pomodoroCount || 4,
  })
}

async function handleDeleteTask(taskId: string) {
  const confirmed = await confirm({
    title: 'Удалить задачу?',
    message: 'Это действие нельзя отменить.',
    confirmText: 'Удалить',
    cancelText: 'Отмена',
  })
  if (confirmed) {
    try {
      await deleteTask(taskId)
    }
    catch (err) {
      console.error('Ошибка удаления задачи:', err)
    }
  }
}

onMounted(() => {
  fetchTasks()
})
</script>

<template>
  <AppHeader title="Задачи" :on-menu-click="openSidebar">
    <template #right>
      <TaskListOptionsMenu v-model:show-completed="showCompleted" v-model:hide-overdue="hideOverdue" />
    </template>
  </AppHeader>
  <PageContainer>
    <!-- Форма добавления новой задачи -->
    <div class="mb-6">
      <TaskForm ref="taskFormRef" :loading="isCreatingTask" @submit="handleAddTask as any" />
    </div>

    <!-- Загрузка -->
    <div v-if="loading" class="text-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
      <p class="mt-2 text-muted-foreground">
        Загрузка задач...
      </p>
    </div>

    <!-- Ошибка -->
    <div v-else-if="error" class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
      <p class="text-destructive">
        {{ error }}
      </p>
      <button
        class="mt-2 px-3 py-1 bg-destructive/20 text-destructive rounded hover:bg-destructive/30"
        @click="fetchTasks"
      >
        Повторить
      </button>
    </div>

    <!-- Список задач -->
    <div v-else>
      <div v-if="sortedTasks.length === 0" class="p-6 text-center text-muted-foreground">
        Пока нет задач. Добавьте первую задачу выше.
      </div>

      <div v-else role="list" class="divide-y divide-border">
        <TaskCard
          v-for="task in sortedTasks"
          :key="task.id"
          :task="task"
          :project-name="getProjectName(task)"
          @toggle="handleToggleTask"
          @show-timer="handleShowTimer"
          @delete="handleDeleteTask"
          @open="handleOpenTask"
        />
      </div>
    </div>
  </PageContainer>
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
