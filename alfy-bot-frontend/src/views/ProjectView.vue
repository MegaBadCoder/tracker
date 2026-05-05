<script setup lang="ts">
import type { Task } from '@/features/tasks/model/types'
import { storeToRefs } from 'pinia'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import PageContainer from '@/components/PageContainer.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useColumnStore } from '@/features/projects/model/column-store'
import { useProjectStore } from '@/features/projects/model/project-store'
import BoardView from '@/features/projects/ui/BoardView.vue'
import GroupedListView from '@/features/projects/ui/GroupedListView.vue'
import ViewModeToggle from '@/features/projects/ui/ViewModeToggle.vue'
import { useHideOverdue } from '@/features/tasks/lib/use-hide-overdue'
import { useShowCompleted } from '@/features/tasks/lib/use-show-completed'
import { useTaskDetailHandlers } from '@/features/tasks/lib/use-task-detail-handlers'
import { useTaskStore } from '@/features/tasks/model/task-store'
import TaskDetailDialog from '@/features/tasks/ui/TaskDetailDialog.vue'
import TaskForm from '@/features/tasks/ui/TaskForm.vue'
import TaskListOptionsMenu from '@/features/tasks/ui/TaskListOptionsMenu.vue'

const openSidebar = inject<() => void>('openSidebar')
const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const projectStore = useProjectStore()
const project = computed(() => projectStore.projectMap.get(projectId.value))
const isBoardMode = computed(() => project.value?.viewMode === 'board')

const showCompleted = useShowCompleted(projectId)
const hideOverdue = useHideOverdue(projectId)

const columnStore = useColumnStore()
const columns = computed(() => columnStore.columns)

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

const filteredTasks = computed(() => {
  return tasks.value
    .filter(t => t.projectId === projectId.value)
    .filter(t => showCompleted.value || !t.completed)
    .filter(t => !hideOverdue.value || !t.isOverdue)
    .sort((a, b) => {
      if (a.completed === b.completed)
        return (a.order ?? 0) - (b.order ?? 0)
      return a.completed ? 1 : -1
    })
})

async function handleViewModeChange(mode: string) {
  await projectStore.updateProject(projectId.value, { viewMode: mode as 'list' | 'board' })
}

async function handleAddTask(taskData: Omit<Task, 'id' | 'pomodoroCompleted'>) {
  isCreatingTask.value = true
  try {
    await createTask({ ...taskData, projectId: projectId.value })
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

function handleShowTimer(_taskId: string) {
  // Timer integration if needed
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
  columnStore.fetchColumns(projectId.value)
})

watch(projectId, (id) => {
  if (id)
    columnStore.fetchColumns(id)
})
</script>

<template>
  <div class="flex flex-col h-[100dvh]">
    <AppHeader :title="project?.title ?? 'Проект'" :on-menu-click="openSidebar" :fluid="isBoardMode">
      <template #right>
        <ViewModeToggle
          v-if="project"
          :model-value="project.viewMode"
          @update:model-value="handleViewModeChange"
        />
        <TaskListOptionsMenu v-model:show-completed="showCompleted" v-model:hide-overdue="hideOverdue" />
      </template>
    </AppHeader>

    <!-- Board view — full page -->
    <template v-if="isBoardMode">
      <div class="px-4 py-3">
        <TaskForm ref="taskFormRef" :loading="isCreatingTask" :initial-project-id="projectId" @submit="handleAddTask as any" />
      </div>

      <div v-if="loading" class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p class="mt-2 text-muted-foreground">
          Загрузка задач...
        </p>
      </div>

      <div v-else-if="error" class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mx-4">
        <p class="text-destructive">
          {{ error }}
        </p>
      </div>

      <main v-else class="flex-1 min-h-0 px-4 pb-4">
        <BoardView
          :project-id="projectId"
          :show-completed="showCompleted"
          :hide-overdue="hideOverdue"
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
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p class="mt-2 text-muted-foreground">
          Загрузка задач...
        </p>
      </div>

      <div v-else-if="error" class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
        <p class="text-destructive">
          {{ error }}
        </p>
      </div>

      <GroupedListView
        v-else
        :columns="columns"
        :tasks="filteredTasks"
        @toggle-task="handleToggleTask"
        @open-task="handleOpenTask"
        @delete-task="handleDeleteTask"
        @show-timer="handleShowTimer"
      />
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
