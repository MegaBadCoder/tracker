<template>
  <AppHeader title="Задачи" :on-menu-click="openSidebar" />
  <PageContainer>
    <!-- Форма добавления новой задачи -->
    <div class="mb-6">
      <TaskForm ref="taskFormRef" :loading="isCreatingTask" @submit="handleAddTask as any" />
    </div>

    <!-- Загрузка -->
    <div v-if="loading" class="text-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      <p class="mt-2 text-muted-foreground">Загрузка задач...</p>
    </div>

    <!-- Ошибка -->
    <div v-else-if="error" class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
      <p class="text-destructive">{{ error }}</p>
      <button
        @click="fetchTasks"
        class="mt-2 px-3 py-1 bg-destructive/20 text-destructive rounded hover:bg-destructive/30"
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
          @toggle="handleToggleTask"
          @show-timer="handleShowTimer"
          @delete="handleDeleteTask"
        />
      </div>
    </div>
  </PageContainer>
  <Teleport to="body">
    <TimeBlock />
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, inject } from 'vue'
import TaskCard from '@/features/tasks/ui/TaskCard.vue'
import type { Task } from '@/features/tasks/model/types'
import TaskForm from '@/features/tasks/ui/TaskForm.vue'
import { TimeBlock, useTimerStore } from '@/features/task-timer'
import { useTasks } from '@/features/tasks/api/tasks-api'
import { useConfirm } from '@/composables/useConfirm'
import PageContainer from '@/components/PageContainer.vue'
import AppHeader from '@/components/AppHeader.vue'

const openSidebar = inject<() => void>('openSidebar')

const timerStore = useTimerStore()
const { startTask } = timerStore
const taskFormRef = ref<InstanceType<typeof TaskForm> | null>(null)
const isCreatingTask = ref(false)

const {
  tasks,
  loading,
  error,
  fetchTasks,
  createTask,
  toggleTask,
  deleteTask,
  incrementPomodoro
} = useTasks()

timerStore.onPomodoroIncrement = (taskId: string, increment: number) => {
  incrementPomodoro(taskId, increment)
}

const { confirm } = useConfirm()

const sortedTasks = computed(() => {
  return [...tasks.value].sort((a, b) => {
    if (a.completed === b.completed) return 0
    return a.completed ? 1 : -1
  })
})

const handleAddTask = async (taskData: Omit<Task, 'id' | 'pomodoroCompleted'>) => {
  isCreatingTask.value = true
  try {
    await createTask(taskData)
    taskFormRef.value?.resetForm()
  } catch (err) {
    console.error('Ошибка добавления задачи:', err)
  } finally {
    isCreatingTask.value = false
  }
}

const handleToggleTask = async (taskId: string) => {
  try {
    await toggleTask(taskId)
  } catch (err) {
    console.error('Ошибка обновления задачи:', err)
  }
}

const handleShowTimer = (taskId: string) => {
  const task = tasks.value.find(t => t.id === taskId)
  if (!task?.isPomodoroTask) return

  startTask({
    id: task.id,
    pomodoroTime: task.pomodoroDuration || 25,
    breakTime: task.shortBreak || 5,
    longBreakTime: task.longBreak || 15,
    longBreakInterval: task.longBreakInterval || 4,
    pomodoroCount: task.pomodoroCount || 4
  })
}

const handleDeleteTask = async (taskId: string) => {
  const confirmed = await confirm({
    title: 'Удалить задачу?',
    message: 'Это действие нельзя отменить.',
    confirmText: 'Удалить',
    cancelText: 'Отмена'
  })
  if (confirmed) {
    try {
      await deleteTask(taskId)
    } catch (err) {
      console.error('Ошибка удаления задачи:', err)
    }
  }
}

onMounted(() => {
  fetchTasks()
})
</script>
