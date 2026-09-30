<script setup lang="ts">
import type { Release } from '@/features/projects/model/types'
import { ChevronRight, Plus } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { useConfirm } from '@/composables/useConfirm'
import { releaseDeletionMessage, releaseTasks } from '@/features/projects/lib/release'
import { useColumnStore } from '@/features/projects/model/column-store'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useProjectStore } from '@/features/projects/model/project-store'
import { useReleaseStore } from '@/features/projects/model/release-store'
import InlineTitleInput from '@/features/projects/ui/InlineTitleInput.vue'
import ProjectTabs from '@/features/projects/ui/ProjectTabs.vue'
import ReleaseActionDialog from '@/features/projects/ui/ReleaseActionDialog.vue'
import ReleaseFormDialog from '@/features/projects/ui/ReleaseFormDialog.vue'
import ReleaseRow from '@/features/projects/ui/ReleaseRow.vue'
import { useTaskDetailHandlers } from '@/features/tasks/lib/use-task-detail-handlers'
import { useTaskStore } from '@/features/tasks/model/task-store'
import TaskDetailDialog from '@/features/tasks/ui/TaskDetailDialog.vue'
import { cn } from '@/lib/utils'

const openSidebar = inject<() => void>('openSidebar')
const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)

const projectStore = useProjectStore()
const project = computed(() => projectStore.projectMap.get(projectId.value))
const isAgileProject = computed(() => project.value?.type === 'agile')

const columnStore = useColumnStore()
const groupStore = useGroupStore()
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

const plannedReleases = computed(() => releaseStore.plannedReleasesOf(projectId.value))
const releasedReleases = computed(() => releaseStore.releasedReleasesOf(projectId.value))

const releasesPending = computed(() =>
  releaseStore.isLoading(projectId.value)
  || (!(projectId.value in releaseStore.lists) && !releaseStore.error),
)
const initialLoading = computed(() => releasesPending.value || (loading.value && tasks.value.length === 0))
const loadError = computed(() => error.value || releaseStore.error)

const addingRelease = ref(false)
const showReleased = ref(false)
const formTarget = ref<Release | null>(null)
const releaseTarget = ref<Release | null>(null)

function tasksOf(release: Release) {
  return releaseTasks(tasks.value, release.id)
}

async function handleCreateRelease(name: string) {
  addingRelease.value = false
  try {
    await releaseStore.createRelease(projectId.value, { name })
  }
  catch (err) {
    console.error('Ошибка создания релиза:', err)
  }
}

async function handleDeleteRelease(release: Release) {
  const confirmed = await confirm({
    title: 'Удалить релиз?',
    message: releaseDeletionMessage(release, tasksOf(release).length),
    confirmText: 'Удалить',
    cancelText: 'Отмена',
    variant: 'destructive',
  })
  if (!confirmed)
    return

  try {
    await releaseStore.deleteRelease(projectId.value, release.id)
  }
  catch (err) {
    console.error('Ошибка удаления релиза:', err)
  }
}

function loadProjectData(id: string) {
  columnStore.fetchColumns(id)
  groupStore.ensureGroups(id)
}

onMounted(() => {
  taskStore.fetchTasks()
  loadProjectData(projectId.value)
})

watch(projectId, (id) => {
  if (id)
    loadProjectData(id)
})

watch([projectId, project], ([id, current]) => {
  if (id && current && current.type !== 'agile')
    router.replace({ name: 'tasks-project', params: { projectId: id } })
}, { immediate: true })

watch([projectId, isAgileProject], ([id, isAgile]) => {
  if (id && isAgile)
    releaseStore.ensureReleases(id)
}, { immediate: true })
</script>

<template>
  <div class="flex flex-col">
    <AppHeader :title="project?.title ?? 'Проект'" :on-menu-click="openSidebar" fluid />

    <div class="px-4 py-3">
      <ProjectTabs :project-id="projectId" />
    </div>

    <div v-if="initialLoading" class="py-8 text-center">
      <div class="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      <p class="mt-2 text-muted-foreground">
        Загрузка релизов...
      </p>
    </div>

    <template v-else>
      <div v-if="loadError" class="mx-4 mb-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
        <p class="text-destructive">
          {{ loadError }}
        </p>
      </div>

      <div class="flex flex-col gap-4 px-4 pb-6">
        <div class="max-w-xs">
          <button
            v-if="!addingRelease"
            type="button"
            class="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            @click="addingRelease = true"
          >
            <Plus :size="14" />
            Релиз
          </button>
          <InlineTitleInput
            v-else
            placeholder="Название релиза"
            @submit="handleCreateRelease"
            @cancel="addingRelease = false"
          />
        </div>

        <section class="flex flex-col gap-2" data-testid="planned-releases">
          <h2 class="text-sm font-semibold">
            Запланированные
          </h2>
          <p v-if="plannedReleases.length === 0" class="text-sm text-muted-foreground">
            Нет запланированных релизов.
          </p>
          <ReleaseRow
            v-for="release in plannedReleases"
            :key="release.id"
            :project-id="projectId"
            :release="release"
            :tasks="tasksOf(release)"
            @edit="formTarget = release"
            @release="releaseTarget = release"
            @delete="handleDeleteRelease(release)"
            @open-task="handleOpenTask"
          />
        </section>

        <section v-if="releasedReleases.length > 0" class="flex flex-col gap-2" data-testid="released-releases">
          <button
            type="button"
            class="flex w-fit cursor-pointer items-center gap-1.5 text-sm font-semibold"
            :aria-expanded="showReleased"
            @click="showReleased = !showReleased"
          >
            <ChevronRight :size="14" :class="cn('shrink-0 text-muted-foreground transition-transform', showReleased && 'rotate-90')" />
            Выпущенные ({{ releasedReleases.length }})
          </button>
          <template v-if="showReleased">
            <ReleaseRow
              v-for="release in releasedReleases"
              :key="release.id"
              :project-id="projectId"
              :release="release"
              :tasks="tasksOf(release)"
              @open-task="handleOpenTask"
            />
          </template>
        </section>
      </div>
    </template>
  </div>
  <ReleaseFormDialog
    v-if="formTarget"
    :open="true"
    :project-id="projectId"
    :release="formTarget"
    @update:open="formTarget = null"
  />
  <ReleaseActionDialog
    v-if="releaseTarget"
    :open="true"
    :project-id="projectId"
    :release="releaseTarget"
    @update:open="releaseTarget = null"
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
