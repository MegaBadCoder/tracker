<script setup lang="ts">
import type { EpicFilter } from '@/features/projects/lib/backlog-stories'
import type { Sprint } from '@/features/projects/model/types'
import type { Task } from '@/features/tasks/model/types'
import { Plus } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/composables/useConfirm'
import { apiErrorMessage } from '@/features/projects/lib/api-error'
import { matchesEpic } from '@/features/projects/lib/backlog-stories'
import { findGroup } from '@/features/projects/lib/group-tree'
import { sprintDeletionMessage, sprintTasks } from '@/features/projects/lib/sprint'
import { useColumnStore } from '@/features/projects/model/column-store'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useProjectStore } from '@/features/projects/model/project-store'
import { useReleaseStore } from '@/features/projects/model/release-store'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import BacklogEpicsPanel from '@/features/projects/ui/BacklogEpicsPanel.vue'
import ProjectTabs from '@/features/projects/ui/ProjectTabs.vue'
import SprintBlock from '@/features/projects/ui/SprintBlock.vue'
import SprintCompleteDialog from '@/features/projects/ui/SprintCompleteDialog.vue'
import SprintFormDialog from '@/features/projects/ui/SprintFormDialog.vue'
import { useHideOverdue } from '@/features/tasks/lib/use-hide-overdue'
import { useShowCompleted } from '@/features/tasks/lib/use-show-completed'
import { useTaskDetailHandlers } from '@/features/tasks/lib/use-task-detail-handlers'
import { useTaskStore } from '@/features/tasks/model/task-store'
import TaskDetailDialog from '@/features/tasks/ui/TaskDetailDialog.vue'
import TaskForm from '@/features/tasks/ui/TaskForm.vue'
import TaskListOptionsMenu from '@/features/tasks/ui/TaskListOptionsMenu.vue'

const openSidebar = inject<() => void>('openSidebar')
const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)

const projectStore = useProjectStore()
const project = computed(() => projectStore.projectMap.get(projectId.value))
const isAgileProject = computed(() => project.value?.type === 'agile')

const showCompleted = useShowCompleted(projectId)
const hideOverdue = useHideOverdue(projectId)
const epicFilter = ref<EpicFilter>('all')
const actionError = ref<string | null>(null)

const columnStore = useColumnStore()
const groupStore = useGroupStore()
const sprintStore = useSprintStore()
const releaseStore = useReleaseStore()
const taskStore = useTaskStore()
const { tasks, loading, error } = storeToRefs(taskStore)

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

const activeSprint = computed(() => sprintStore.activeSprintOf(projectId.value))
const plannedSprints = computed(() => sprintStore.plannedSprintsOf(projectId.value))

const sprintsPending = computed(() =>
  sprintStore.isLoading(projectId.value)
  || (!(projectId.value in sprintStore.lists) && !sprintStore.error),
)
const initialLoading = computed(() => sprintsPending.value || (loading.value && tasks.value.length === 0))
const loadError = computed(() => actionError.value || error.value || sprintStore.error || groupStore.error || releaseStore.error)

function blockTasks(sprintId: string | null): Task[] {
  return sprintTasks(tasks.value, sprintId, projectId.value)
    .filter(t => matchesEpic(t, groupStore.groupsOf(projectId.value), epicFilter.value))
    .filter(t => showCompleted.value || !t.completed)
    .filter(t => !hideOverdue.value || !t.isOverdue)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

async function handleMoveTask(taskId: string, sprintId: string | null) {
  actionError.value = null
  try {
    await taskStore.updateTask(taskId, { sprintId })
  }
  catch (err) {
    actionError.value = apiErrorMessage(err, 'Не удалось перенести задачу')
  }
}

async function handleMoveStory(storyId: string, sprintId: string | null) {
  actionError.value = null
  try {
    await sprintStore.setStorySprint(projectId.value, storyId, sprintId)
  }
  catch (err) {
    actionError.value = apiErrorMessage(err, 'Не удалось перенести историю')
  }
}

const creationTarget = ref<{ projectId: string, sprintId: string | null, groupId?: string } | null>(null)
const isCreatingTask = ref(false)
const taskCreationError = ref<string | null>(null)
const creationStory = computed(() => creationTarget.value?.groupId
  ? findGroup(groupStore.groupsOf(creationTarget.value.projectId), creationTarget.value.groupId)
  : null)
const isReleasedStory = computed(() => !!creationTarget.value && releaseStore.releasesOf(creationTarget.value.projectId)
  .some(release => release.id === creationStory.value?.releaseId && release.status === 'released'))
const creationLabel = computed(() => {
  const target = creationTarget.value
  if (!target)
    return ''
  const sprint = sprintStore.lists[target.projectId]?.find(item => item.id === target.sprintId)
  return [project.value?.title, sprint?.name ?? 'Бэклог', creationStory.value?.title].filter(Boolean).join(' · ')
})

function openTaskCreation(sprintId: string | null, groupId?: string) {
  if (isCreatingTask.value)
    return
  taskCreationError.value = null
  creationTarget.value = { projectId: projectId.value, sprintId, groupId }
}

function closeTaskCreation(open: boolean) {
  if (!open && !isCreatingTask.value)
    creationTarget.value = null
}

async function handleCreateTask(data: Omit<Task, 'id' | 'completed' | 'pomodoroCompleted'>) {
  const target = creationTarget.value
  if (!target || isCreatingTask.value)
    return
  isCreatingTask.value = true
  taskCreationError.value = null
  try {
    await taskStore.createTask({ ...data, completed: false, projectId: target.projectId, sprintId: target.sprintId, groupId: target.groupId ?? null, ...(isReleasedStory.value ? { releaseId: null } : {}) })
    if (creationTarget.value === target)
      creationTarget.value = null
  }
  catch (err) {
    if (creationTarget.value === target)
      taskCreationError.value = apiErrorMessage(err, 'Не удалось создать задачу')
  }
  finally {
    isCreatingTask.value = false
  }
}

async function handleToggleTask(taskId: string) {
  try {
    await taskStore.toggleTask(taskId)
  }
  catch (err) {
    console.error('Ошибка обновления задачи:', err)
  }
}

async function handleCreateSprint() {
  try {
    await sprintStore.createSprint(projectId.value, {})
  }
  catch (err) {
    console.error('Ошибка создания спринта:', err)
  }
}

const formTarget = ref<{ mode: 'start' | 'edit', sprint: Sprint } | null>(null)
const completeTarget = ref<Sprint | null>(null)

async function handleDeleteSprint(sprint: Sprint) {
  const taskCount = tasks.value.filter(t => t.sprintId === sprint.id).length
  const confirmed = await confirm({
    title: 'Удалить спринт?',
    message: sprintDeletionMessage(sprint, taskCount),
    confirmText: 'Удалить',
    cancelText: 'Отмена',
    variant: 'destructive',
  })
  if (!confirmed)
    return

  try {
    await sprintStore.deleteSprint(projectId.value, sprint.id)
  }
  catch (err) {
    console.error('Ошибка удаления спринта:', err)
  }
}

function loadProjectData(id: string) {
  columnStore.fetchColumns(id)
  groupStore.ensureGroups(id)
  releaseStore.ensureReleases(id)
}

watch(() => groupStore.groupsOf(projectId.value), (tree) => {
  if (epicFilter.value !== 'all' && epicFilter.value !== 'none' && !tree.some(epic => epic.id === epicFilter.value))
    epicFilter.value = 'all'
})

onMounted(() => {
  taskStore.fetchTasks()
  loadProjectData(projectId.value)
})

watch(projectId, (id) => {
  epicFilter.value = 'all'
  actionError.value = null
  creationTarget.value = null
  if (id)
    loadProjectData(id)
})

watch([projectId, project], ([id, current]) => {
  if (id && current && current.type !== 'agile')
    router.replace({ name: 'tasks-project', params: { projectId: id } })
}, { immediate: true })

watch([projectId, isAgileProject], ([id, isAgile]) => {
  if (id && isAgile)
    sprintStore.ensureSprints(id)
}, { immediate: true })
</script>

<template>
  <div class="flex flex-col">
    <AppHeader :title="project?.title ?? 'Проект'" :on-menu-click="openSidebar" fluid>
      <template #right>
        <TaskListOptionsMenu v-model:show-completed="showCompleted" v-model:hide-overdue="hideOverdue" />
      </template>
    </AppHeader>

    <div class="px-4 py-3">
      <ProjectTabs :project-id="projectId" />
    </div>

    <div v-if="initialLoading" class="py-8 text-center">
      <div class="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      <p class="mt-2 text-muted-foreground">
        Загрузка бэклога...
      </p>
    </div>

    <template v-else>
      <div v-if="loadError" class="mx-4 mb-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
        <p class="text-destructive" role="alert">
          {{ loadError }}
        </p>
      </div>

      <div class="flex flex-col gap-4 px-4 pb-6 md:flex-row md:items-start">
        <BacklogEpicsPanel v-model="epicFilter" :project-id="projectId" />

        <div class="flex min-w-0 flex-1 flex-col gap-4">
          <SprintBlock
            v-if="activeSprint"
            :project-id="projectId"
            :sprint="activeSprint"
            :tasks="blockTasks(activeSprint.id)"
            :epic-filter="epicFilter"
            :show-completed="showCompleted"
            can-manage
            :has-active-sprint="true"
            @complete="completeTarget = activeSprint"
            @move-task="handleMoveTask"
            @move-story="handleMoveStory"
            @create-task="openTaskCreation(activeSprint.id)"
            @create-story-task="groupId => openTaskCreation(activeSprint!.id, groupId)"
            @open-task="handleOpenTask"
            @toggle-task="handleToggleTask"
          />
          <SprintBlock
            v-for="sprint in plannedSprints"
            :key="sprint.id"
            :project-id="projectId"
            :sprint="sprint"
            :tasks="blockTasks(sprint.id)"
            :epic-filter="epicFilter"
            :show-completed="showCompleted"
            can-start
            can-manage
            :has-active-sprint="!!activeSprint"
            @start="formTarget = { mode: 'start', sprint }"
            @edit="formTarget = { mode: 'edit', sprint }"
            @delete="handleDeleteSprint(sprint)"
            @move-task="handleMoveTask"
            @move-story="handleMoveStory"
            @create-task="openTaskCreation(sprint.id)"
            @create-story-task="groupId => openTaskCreation(sprint.id, groupId)"
            @open-task="handleOpenTask"
            @toggle-task="handleToggleTask"
          />
          <div>
            <Button variant="outline" size="sm" @click="handleCreateSprint">
              <Plus :size="14" />
              Создать спринт
            </Button>
          </div>
          <SprintBlock
            :project-id="projectId"
            :sprint="null"
            :tasks="blockTasks(null)"
            :epic-filter="epicFilter"
            :show-completed="showCompleted"
            :has-active-sprint="!!activeSprint"
            @move-task="handleMoveTask"
            @move-story="handleMoveStory"
            @create-task="openTaskCreation(null)"
            @create-story-task="groupId => openTaskCreation(null, groupId)"
            @open-task="handleOpenTask"
            @toggle-task="handleToggleTask"
          />
        </div>
      </div>
    </template>
  </div>
  <Dialog :open="!!creationTarget" @update:open="closeTaskCreation">
    <DialogContent class="max-h-[90dvh] overflow-y-auto sm:max-w-xl" @interact-outside.prevent @escape-key-down="isCreatingTask && $event.preventDefault()">
      <DialogHeader>
        <DialogTitle>Новая задача</DialogTitle>
        <DialogDescription>{{ creationLabel }}</DialogDescription>
      </DialogHeader>
      <p v-if="isReleasedStory" class="text-sm text-muted-foreground">
        Новая задача будет без релиза. Релиз можно выбрать в её карточке.
      </p>
      <TaskForm v-if="creationTarget" modal :loading="isCreatingTask" @submit="handleCreateTask" @cancel="closeTaskCreation(false)" />
      <p v-if="taskCreationError" role="alert" class="text-sm text-destructive">
        {{ taskCreationError }}
      </p>
    </DialogContent>
  </Dialog>
  <SprintFormDialog
    v-if="formTarget"
    :open="true"
    :mode="formTarget.mode"
    :project-id="projectId"
    :sprint="formTarget.sprint"
    @update:open="formTarget = null"
  />
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
