<template>
  <div class="flex flex-col h-[100dvh]">
    <AppHeader :title="project?.title ?? 'Проект'" :on-menu-click="openSidebar" :fluid="isBoardMode">
      <template #right>
        <ViewModeToggle
          v-if="project"
          :model-value="project.viewMode"
          @update:model-value="handleViewModeChange"
        />
      </template>
    </AppHeader>

    <!-- Board view — full page -->
    <template v-if="isBoardMode">
      <div class="px-4 py-3">
        <TaskForm ref="taskFormRef" :loading="isCreatingTask" :initial-project-id="projectId" @submit="handleAddTask as any" />
      </div>

      <div v-if="loading" class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p class="mt-2 text-muted-foreground">Загрузка задач...</p>
      </div>

      <div v-else-if="error" class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mx-4">
        <p class="text-destructive">{{ error }}</p>
      </div>

      <main v-else class="flex-1 min-h-0 px-4 pb-4">
        <BoardView
          :project-id="projectId"
          @toggle-task="handleToggleTask"
          @open-task="handleOpenTask"
        />
      </main>
    </template>

    <!-- List view — constrained width -->
    <PageContainer v-else>
      <div class="mb-6">
        <TaskForm ref="taskFormRef" :loading="isCreatingTask" :initial-project-id="projectId" @submit="handleAddTask as any" />
      </div>

      <div v-if="loading" class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p class="mt-2 text-muted-foreground">Загрузка задач...</p>
      </div>

      <div v-else-if="error" class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
        <p class="text-destructive">{{ error }}</p>
      </div>

      <div v-else>
        <GroupedListView
          v-if="columns.length > 0"
          :columns="columns"
          :tasks="filteredTasks"
          @toggle-task="handleToggleTask"
          @open-task="handleOpenTask"
          @delete-task="handleDeleteTask"
          @show-timer="handleShowTimer"
        />

        <template v-else>
          <div v-if="filteredTasks.length === 0" class="p-6 text-center text-muted-foreground">
            В этом проекте пока нет задач.
          </div>

          <div v-else role="list" class="divide-y divide-border">
            <TaskCard
              v-for="task in filteredTasks"
              :key="task.id"
              :task="task"
              @toggle="handleToggleTask"
              @show-timer="handleShowTimer"
              @delete="handleDeleteTask"
              @open="handleOpenTask"
            />
          </div>
        </template>
      </div>
    </PageContainer>
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
import { onMounted, ref, computed, inject, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import TaskCard from '@/features/tasks/ui/TaskCard.vue'
import type { Task, ChecklistItem } from '@/features/tasks/model/types'
import TaskForm from '@/features/tasks/ui/TaskForm.vue'
import TaskDetailDialog from '@/features/tasks/ui/TaskDetailDialog.vue'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { useProjectStore } from '@/features/projects/model/project-store'
import { useColumnStore } from '@/features/projects/model/column-store'
import { useConfirm } from '@/composables/useConfirm'
import PageContainer from '@/components/PageContainer.vue'
import AppHeader from '@/components/AppHeader.vue'
import ViewModeToggle from '@/features/projects/ui/ViewModeToggle.vue'
import BoardView from '@/features/projects/ui/BoardView.vue'
import GroupedListView from '@/features/projects/ui/GroupedListView.vue'

const openSidebar = inject<() => void>('openSidebar')
const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const projectStore = useProjectStore()
const project = computed(() => projectStore.projectMap.get(projectId.value))
const isBoardMode = computed(() => project.value?.viewMode === 'board')

const columnStore = useColumnStore()
const columns = computed(() => columnStore.columns)

const taskFormRef = ref<InstanceType<typeof TaskForm> | null>(null)
const isCreatingTask = ref(false)

const taskStore = useTaskStore()
const { tasks, loading, error } = storeToRefs(taskStore)
const {
  fetchTasks,
  createTask,
  updateTask,
  toggleTask,
  deleteTask,
  updateChecklist,
  updatePomodoroConfig,
} = taskStore

const { confirm } = useConfirm()

const selectedTask = ref<Task | null>(null)
const isDetailOpen = ref(false)

const filteredTasks = computed(() => {
  return tasks.value
    .filter(t => t.projectId === projectId.value)
    .sort((a, b) => {
      if (a.completed === b.completed) return (a.order ?? 0) - (b.order ?? 0)
      return a.completed ? 1 : -1
    })
})

const handleOpenTask = (task: Task) => {
  selectedTask.value = task
  isDetailOpen.value = true
}

async function handleViewModeChange(mode: string) {
  await projectStore.updateProject(projectId.value, { viewMode: mode as 'list' | 'board' })
}

const handleUpdateTask = async (updatedTask: Task) => {
  const index = tasks.value.findIndex(t => t.id === updatedTask.id)
  const previous: Task | null = index !== -1 ? { ...tasks.value[index] } as Task : null

  if (index !== -1) tasks.value[index] = updatedTask
  selectedTask.value = updatedTask

  try {
    await updateTask(updatedTask.id, updatedTask, false)
  } catch (err) {
    if (previous && index !== -1) {
      tasks.value[index] = previous
      selectedTask.value = previous
    }
  }
}

const handleUpdateChecklist = async (taskId: string, items: ChecklistItem[]) => {
  const index = tasks.value.findIndex(t => t.id === taskId)
  const previousChecklist = index !== -1 ? tasks.value[index]?.checklist : undefined
  if (index !== -1) {
    tasks.value[index] = { ...tasks.value[index], checklist: { items } } as Task
  }
  if (selectedTask.value?.id === taskId) {
    selectedTask.value = { ...selectedTask.value, checklist: { items } } as Task
  }

  try {
    await updateChecklist(taskId, items)
  } catch (err) {
    if (index !== -1) {
      tasks.value[index] = { ...tasks.value[index], checklist: previousChecklist } as Task
    }
    if (selectedTask.value?.id === taskId) {
      selectedTask.value = { ...selectedTask.value, checklist: previousChecklist } as Task
    }
  }
}

const handleUpdatePomodoroConfig = async (taskId: string, config: Record<string, unknown>) => {
  const index = tasks.value.findIndex(t => t.id === taskId)
  const previous: Task | null = index !== -1 ? { ...tasks.value[index] } as Task : null

  if (index !== -1) {
    tasks.value[index] = { ...tasks.value[index], ...config } as Task
  }
  if (selectedTask.value?.id === taskId) {
    selectedTask.value = { ...selectedTask.value, ...config } as Task
  }

  try {
    await updatePomodoroConfig(taskId, config)
  } catch (err) {
    if (previous && index !== -1) {
      tasks.value[index] = previous
      selectedTask.value = previous
    }
  }
}

const handleDeleteFromDialog = async (taskId: string) => {
  isDetailOpen.value = false
  selectedTask.value = null
  await handleDeleteTask(taskId)
}

const handleAddTask = async (taskData: Omit<Task, 'id' | 'pomodoroCompleted'>) => {
  isCreatingTask.value = true
  try {
    await createTask({ ...taskData, projectId: projectId.value })
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

const handleShowTimer = (_taskId: string) => {
  // Timer integration if needed
}

const handleDeleteTask = async (taskId: string) => {
  const confirmed = await confirm({
    title: 'Удалить задачу?',
    message: 'Это действие нельзя отменить.',
    confirmText: 'Удалить',
    cancelText: 'Отмена',
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
  columnStore.fetchColumns(projectId.value)
})

watch(projectId, (id) => {
  if (id) columnStore.fetchColumns(id)
})
</script>
