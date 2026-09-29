<script setup lang="ts">
import type { Sprint } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { storeToRefs } from 'pinia'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import PageContainer from '@/components/PageContainer.vue'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/composables/useConfirm'
import { useColumnStore } from '@/features/projects/model/column-store'
import { useProjectStore } from '@/features/projects/model/project-store'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import AgileBoardView from '@/features/projects/ui/AgileBoardView.vue'
import BoardView from '@/features/projects/ui/BoardView.vue'
import GroupedListView from '@/features/projects/ui/GroupedListView.vue'
import ProjectTabs from '@/features/projects/ui/ProjectTabs.vue'
import SprintBanner from '@/features/projects/ui/SprintBanner.vue'
import SprintCompleteDialog from '@/features/projects/ui/SprintCompleteDialog.vue'
import ViewModeToggle from '@/features/projects/ui/ViewModeToggle.vue'
import { useReorderList } from '@/features/tasks/lib/dnd/use-reorder-list'
import { useTaskDnd } from '@/features/tasks/lib/dnd/use-task-dnd'
import { useHideOverdue } from '@/features/tasks/lib/use-hide-overdue'
import { useShowCompleted } from '@/features/tasks/lib/use-show-completed'
import { useTaskDetailHandlers } from '@/features/tasks/lib/use-task-detail-handlers'
import { useTaskStore } from '@/features/tasks/model/task-store'
import TaskCard from '@/features/tasks/ui/TaskCard.vue'
import TaskDetailDialog from '@/features/tasks/ui/TaskDetailDialog.vue'
import TaskForm from '@/features/tasks/ui/TaskForm.vue'
import TaskListOptionsMenu from '@/features/tasks/ui/TaskListOptionsMenu.vue'

const openSidebar = inject<() => void>('openSidebar')
const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const projectStore = useProjectStore()
const project = computed(() => projectStore.projectMap.get(projectId.value))
const isBoardMode = computed(() => project.value?.viewMode === 'board')
const isAgileProject = computed(() => project.value?.type === 'agile')

const showCompleted = useShowCompleted(projectId)
const hideOverdue = useHideOverdue(projectId)

const columnStore = useColumnStore()
const columns = computed(() => columnStore.columns)

const sprintStore = useSprintStore()
const activeSprint = computed(() => sprintStore.activeSprintOf(projectId.value))
const sprintsPending = computed(() =>
  sprintStore.isLoading(projectId.value)
  || (!(projectId.value in sprintStore.lists) && !sprintStore.error),
)

const completeTarget = ref<Sprint | null>(null)

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

const dnd = useTaskDnd()
const draggedId = computed(() => dnd.state.active?.task.id ?? null)
const draggedHeight = computed(() => dnd.state.active?.originRect.height ?? 0)

const filteredTasks = computed(() => {
  return tasks.value
    .filter(t => t.projectId === projectId.value)
    .filter(t => showCompleted.value || !t.completed)
    .filter(t => !hideOverdue.value || !t.isOverdue)
    .filter(t => t.id !== draggedId.value)
    .sort((a, b) => {
      const w = (t: Task) => (t.isOverdue ? 2 : 0) + (t.completed ? 1 : 0)
      const wd = w(a) - w(b)
      if (wd !== 0)
        return wd
      return (a.order ?? 0) - (b.order ?? 0)
    })
})

// Reorder list for flat list branch (columns.length === 0)
const listEl = ref<HTMLElement | null>(null)

function getItems() {
  if (!listEl.value)
    return []
  return Array.from(listEl.value.querySelectorAll<HTMLElement>('[data-task-id]'))
    .map(el => ({ id: el.dataset.taskId!, el }))
}

const { insertionIndex } = useReorderList({
  scope: () => `project:${projectId.value}`,
  listEl,
  getItems,
})

async function handleViewModeChange(mode: string) {
  await projectStore.updateProject(projectId.value, { viewMode: mode as 'list' | 'board' })
}

async function handleAddTask(taskData: Omit<Task, 'id' | 'pomodoroCompleted'>) {
  isCreatingTask.value = true
  try {
    if (isAgileProject.value) {
      if (!activeSprint.value)
        throw new Error('Нет активного спринта для новой задачи')
      await createTask({ ...taskData, projectId: projectId.value, sprintId: activeSprint.value.id })
    }
    else {
      await createTask({ ...taskData, projectId: projectId.value })
    }
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
  if (isAgileProject.value)
    sprintStore.ensureSprints(projectId.value)
})

watch(projectId, (id) => {
  if (id)
    columnStore.fetchColumns(id)
})

watch([projectId, isAgileProject], ([id, isAgile]) => {
  if (id && isAgile)
    sprintStore.ensureSprints(id)
})
</script>

<template>
  <div class="flex flex-col" :class="[(isBoardMode || isAgileProject) && 'h-[100dvh]']">
    <AppHeader :title="project?.title ?? 'Проект'" :on-menu-click="openSidebar" :fluid="isBoardMode || isAgileProject">
      <template #right>
        <ViewModeToggle
          v-if="project && !isAgileProject"
          :model-value="project.viewMode"
          @update:model-value="handleViewModeChange"
        />
        <TaskListOptionsMenu v-model:show-completed="showCompleted" v-model:hide-overdue="hideOverdue" />
      </template>
    </AppHeader>

    <!-- Agile view — full page -->
    <template v-if="isAgileProject">
      <div class="px-4 pt-3">
        <ProjectTabs :project-id="projectId" />
      </div>

      <div v-if="loading || sprintsPending" class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p class="mt-2 text-muted-foreground">
          Загрузка задач...
        </p>
      </div>

      <div v-else-if="error || sprintStore.error" class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 m-4">
        <p class="text-destructive">
          {{ error || sprintStore.error }}
        </p>
      </div>

      <div v-else-if="!activeSprint" class="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-12 text-center">
        <p class="text-lg font-medium">
          Нет активного спринта
        </p>
        <p class="text-sm text-muted-foreground">
          Выберите задачи в бэклоге и начните спринт
        </p>
        <Button as-child class="mt-2">
          <RouterLink :to="{ name: 'tasks-project-backlog', params: { projectId } }">
            Перейти в бэклог
          </RouterLink>
        </Button>
      </div>

      <template v-else>
        <SprintBanner class="mt-3" :project-id="projectId" can-complete @complete="completeTarget = activeSprint" />

        <div class="px-4 py-3">
          <TaskForm ref="taskFormRef" :loading="isCreatingTask" :initial-project-id="projectId" @submit="handleAddTask as any" />
        </div>

        <main class="flex-1 min-h-0 px-4 pb-4">
          <AgileBoardView
            :project-id="projectId"
            :show-completed="showCompleted"
            :hide-overdue="hideOverdue"
            @toggle-task="handleToggleTask"
            @open-task="handleOpenTask"
          />
        </main>
      </template>
    </template>

    <!-- Board view — full page -->
    <template v-else-if="isBoardMode">
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

      <!-- Flat list (no columns) — reorder enabled -->
      <template v-else-if="columns.length === 0">
        <div v-if="filteredTasks.length === 0" class="p-6 text-center text-muted-foreground">
          В этом проекте пока нет задач.
        </div>
        <div v-else ref="listEl" role="list" class="divide-y divide-border">
          <template v-for="(task, i) in filteredTasks" :key="task.id">
            <div
              v-if="insertionIndex === i"
              class="border-2 border-dashed border-primary/40 rounded-md bg-primary/5"
              :style="{ height: `${draggedHeight}px` }"
            />
            <TaskCard
              :task="task"
              @toggle="handleToggleTask"
              @show-timer="handleShowTimer"
              @delete="handleDeleteTask"
              @open="handleOpenTask"
            />
          </template>
          <div
            v-if="insertionIndex === filteredTasks.length"
            class="border-2 border-dashed border-primary/40 rounded-md bg-primary/5"
            :style="{ height: `${draggedHeight}px` }"
          />
        </div>
      </template>

      <!-- Grouped list (with columns) — vuedraggable handles its own DnD -->
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
  <SprintCompleteDialog
    v-if="completeTarget"
    :open="true"
    :project-id="projectId"
    :sprint="completeTarget"
    @update:open="completeTarget = null"
  />
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
