<script setup lang="ts">
import type { SprintMapNode } from '@/features/projects/lib/sprint-map'
import type { SprintMapCreateContext } from '@/features/projects/lib/use-sprint-map-create'
import { computed, inject, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import PageContainer from '@/components/PageContainer.vue'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/composables/useConfirm'
import * as columnsApi from '@/features/projects/api/columns-api'
import * as groupsApi from '@/features/projects/api/groups-api'
import { fetchStoryWorkflow } from '@/features/projects/api/planning-api'
import * as projectsApi from '@/features/projects/api/projects-api'
import * as releasesApi from '@/features/projects/api/releases-api'
import * as sprintsApi from '@/features/projects/api/sprints-api'
import { apiErrorMessage } from '@/features/projects/lib/api-error'
import { findGroup } from '@/features/projects/lib/group-tree'
import { buildSprintMap } from '@/features/projects/lib/sprint-map'
import { useColumnStore } from '@/features/projects/model/column-store'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useProjectStore } from '@/features/projects/model/project-store'
import { useReleaseStore } from '@/features/projects/model/release-store'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import { useStoryWorkflowStore } from '@/features/projects/model/story-workflow-store'
import { useGroupDetail } from '@/features/projects/model/use-group-detail'
import ProjectTabs from '@/features/projects/ui/ProjectTabs.vue'
import SprintMapCanvas from '@/features/projects/ui/SprintMapCanvas.vue'
import SprintMapCreateDialog from '@/features/projects/ui/SprintMapCreateDialog.vue'
import { fetchTaskDependencies } from '@/features/tasks/api/task-dependencies-api'
import { useTaskDetailHandlers } from '@/features/tasks/lib/use-task-detail-handlers'
import { useTaskDependencyStore } from '@/features/tasks/model/task-dependency-store'
import { useTaskStore } from '@/features/tasks/model/task-store'
import TaskDetailDialog from '@/features/tasks/ui/TaskDetailDialog.vue'

const openSidebar = inject<() => void>('openSidebar', () => {})
const route = useRoute()
const router = useRouter()
const groups = useGroupStore()
const projects = useProjectStore()
const releases = useReleaseStore()
const sprints = useSprintStore()
const columns = useColumnStore()
const workflow = useStoryWorkflowStore()
const tasks = useTaskStore()
const dependencies = useTaskDependencyStore()
const groupDetail = useGroupDetail()
const { confirm } = useConfirm()
const { selectedTask, isDetailOpen, handleOpenTask, handleDetailOpenChange, handleUpdateTask, handleUpdateChecklist, handleUpdatePomodoroConfig, handleDeleteFromDialog } = useTaskDetailHandlers(tasks, confirm)
const projectId = computed(() => String(route.params.projectId ?? ''))
const project = computed(() => projects.projects.find(item => item.id === projectId.value))
const sprintOptions = computed(() => [...sprints.sprintsOf(projectId.value)].sort((a, b) => a.order - b.order))
const selectedSprint = computed(() => {
  const requested = route.query.sprint
  if (typeof requested === 'string')
    return sprintOptions.value.find(item => item.id === requested)
  return sprintOptions.value.find(item => item.status === 'active')
    ?? sprintOptions.value.find(item => item.status === 'planned')
    ?? [...sprintOptions.value].reverse()[0]
})
const readonly = computed(() => selectedSprint.value?.status === 'closed')
const state = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')
const error = ref('')
const retry = ref(0)
const createContext = ref<SprintMapCreateContext | null>(null)
const tree = computed(() => selectedSprint.value
  ? buildSprintMap({
      projectId: projectId.value,
      sprint: selectedSprint.value,
      groups: groups.groupsOf(projectId.value),
      tasks: tasks.tasks,
      releases: releases.lists[projectId.value] ?? [],
      columns: columns.currentProjectId === projectId.value ? columns.columns : [],
      workflow: workflow.statusesOf(projectId.value),
    })
  : null)

watch([projectId, retry], async ([pid], _, onCleanup) => {
  let active = true
  onCleanup(() => {
    active = false
  })
  state.value = 'loading'
  error.value = ''
  try {
    const dependencyRevision = dependencies.revision
    const [projectResponse, groupResponse, releaseResponse, sprintResponse, columnResponse, workflowResponse, taskSnapshot, dependencyResponse] = await Promise.all([
      projectsApi.fetchProject(pid),
      groupsApi.fetchGroups(pid),
      releasesApi.fetchReleases(pid),
      sprintsApi.fetchSprints(pid),
      columnsApi.fetchColumns(pid),
      fetchStoryWorkflow(pid),
      tasks.fetchTaskSnapshot(),
      fetchTaskDependencies(),
    ])
    if (!active)
      return
    if (!dependencies.applySnapshot(dependencyResponse.data, dependencyRevision)) {
      await dependencies.fetchGraph()
      if (!active)
        return
    }
    tasks.tasks = taskSnapshot
    groups.trees[pid] = groupResponse.data
    releases.lists[pid] = releaseResponse.data
    sprints.lists[pid] = sprintResponse.data
    columns.currentProjectId = pid
    columns.columns = columnResponse.data
    workflow.catalogs[pid] = workflowResponse.data.statuses
    const index = projects.projects.findIndex(item => item.id === pid)
    if (index < 0)
      projects.projects.push(projectResponse.data)
    else projects.projects[index] = projectResponse.data
    state.value = 'ready'
  }
  catch (err) {
    if (!active)
      return
    if ((err as { response?: { status?: number } }).response?.status === 404) {
      state.value = 'missing'
    }
    else {
      state.value = 'error'
      error.value = apiErrorMessage(err, 'Не удалось загрузить карту спринта')
    }
  }
}, { immediate: true })

watch([projectId, () => selectedSprint.value?.id], () => {
  createContext.value = null
  isDetailOpen.value = false
  groupDetail.close()
})

function selectSprint(event: Event) {
  const sprint = (event.target as HTMLSelectElement).value
  void router.replace({ query: { ...route.query, sprint } })
}

function openNode(node: SprintMapNode) {
  if (!node.sourceId)
    return
  if (node.kind === 'task') {
    const task = tasks.tasks.find(item => item.id === node.sourceId && item.projectId === projectId.value)
    if (task)
      handleOpenTask(task)
  }
  else if (node.kind === 'epic' || node.kind === 'story') {
    groupDetail.open(projectId.value, node.sourceId)
  }
}

function addChild(node: SprintMapNode) {
  const sprint = selectedSprint.value
  if (!sprint || readonly.value || !node.sourceId || node.sourceId.startsWith('temp-'))
    return
  if (node.kind !== 'story' && node.kind !== 'epic' && node.kind !== 'sprint')
    return
  const parent = findGroup(groups.groupsOf(projectId.value), node.sourceId)
  const release = releases.lists[projectId.value]?.find(item => item.id === parent?.releaseId)
  createContext.value = {
    projectId: projectId.value,
    sprintId: sprint.id,
    kind: node.kind === 'story' ? 'task' : node.kind === 'epic' ? 'story' : 'epic',
    parentId: node.kind === 'sprint' ? null : node.sourceId,
    releaseId: release?.status === 'planned' ? release.id : null,
  }
}
</script>

<template>
  <AppHeader :title="project?.title ?? 'Карта спринта'" :on-menu-click="openSidebar" />
  <PageContainer class="min-w-0 space-y-4">
    <ProjectTabs v-if="state === 'ready' && project?.type === 'agile'" :project-id="projectId" />
    <p v-if="state === 'loading'" role="status" class="p-5 text-muted-foreground">
      Загрузка карты…
    </p>
    <div v-else-if="state === 'error'" class="space-y-4 p-5">
      <p role="alert" class="text-destructive">
        {{ error }}
      </p>
      <Button variant="outline" @click="retry++">
        Повторить
      </Button>
    </div>
    <p v-else-if="state === 'missing'" class="p-5">
      Проект не найден
    </p>
    <div v-else-if="project?.type !== 'agile'" class="space-y-3 p-5">
      <h1 class="text-lg font-semibold">
        Карта доступна для agile-проекта
      </h1>
      <RouterLink :to="{ name: 'tasks-project', params: { projectId } }" class="text-primary hover:underline">
        К проекту
      </RouterLink>
    </div>
    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-xl font-semibold tracking-tight">
            Карта спринта
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Задачи → истории → эпики → результат спринта
          </p>
        </div>
        <label v-if="sprintOptions.length" class="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
          Спринт
          <select :value="selectedSprint?.id ?? ''" aria-label="Спринт карты" class="h-9 w-full max-w-72 rounded-md border border-input bg-background px-3 text-sm text-foreground" @change="selectSprint">
            <option v-if="!selectedSprint" value="" disabled>Выберите спринт</option>
            <option v-for="sprint in sprintOptions" :key="sprint.id" :value="sprint.id">
              {{ sprint.name }} · {{ { active: 'Активный', planned: 'Планируется', closed: 'Закрыт' }[sprint.status] }}
            </option>
          </select>
        </label>
      </div>
      <div v-if="!sprintOptions.length" class="rounded-xl border border-dashed p-8 text-center">
        <h2 class="font-medium">
          Пока нет спринтов
        </h2>
        <p class="mt-2 text-sm text-muted-foreground">
          Создайте спринт в бэклоге — здесь появится его карта.
        </p>
        <RouterLink :to="{ name: 'tasks-project-backlog', params: { projectId } }" class="mt-4 inline-block text-sm text-primary hover:underline">
          Открыть бэклог
        </RouterLink>
      </div>
      <p v-else-if="!tree" role="status" class="p-5 text-muted-foreground">
        Спринт не найден. Выберите другой спринт.
      </p>
      <template v-else>
        <p v-if="readonly" class="text-sm text-muted-foreground">
          Спринт закрыт. Добавление новых элементов недоступно.
        </p>
        <SprintMapCanvas :key="`${projectId}/${tree.key}`" :root="tree" :project-id="projectId" :readonly="readonly" :tasks="tasks.tasks" :dependencies="dependencies.edges" @open-node="openNode" @add-child="addChild" />
      </template>
    </template>
    <SprintMapCreateDialog v-if="createContext && selectedSprint" :context="createContext" :sprint-name="selectedSprint.name" :closed="readonly" @close="createContext = null" @created="createContext = null" />
    <TaskDetailDialog :task="selectedTask" :open="isDetailOpen" @update:open="handleDetailOpenChange" @delete="handleDeleteFromDialog" @update="handleUpdateTask" @update:checklist="handleUpdateChecklist" @update:pomodoro-config="handleUpdatePomodoroConfig" />
  </PageContainer>
</template>
