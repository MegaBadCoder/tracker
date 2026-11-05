<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import PageContainer from '@/components/PageContainer.vue'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/composables/useConfirm'
import * as groupsApi from '@/features/projects/api/groups-api'
import * as projectsApi from '@/features/projects/api/projects-api'
import * as releasesApi from '@/features/projects/api/releases-api'
import { apiErrorMessage } from '@/features/projects/lib/api-error'
import { findGroup } from '@/features/projects/lib/group-tree'
import { useGroupDeletion } from '@/features/projects/lib/use-group-deletion'
import { useGroupStore } from '@/features/projects/model/group-store'
import { useProjectStore } from '@/features/projects/model/project-store'
import { useReleaseStore } from '@/features/projects/model/release-store'
import GroupDetailContent from '@/features/projects/ui/GroupDetailContent.vue'
import { useTaskDetailHandlers } from '@/features/tasks/lib/use-task-detail-handlers'
import { useTaskStore } from '@/features/tasks/model/task-store'
import TaskDetailDialog from '@/features/tasks/ui/TaskDetailDialog.vue'

const openSidebar = inject<() => void>('openSidebar', () => {})
const route = useRoute()
const router = useRouter()
const groups = useGroupStore()
const projects = useProjectStore()
const releases = useReleaseStore()
const tasks = useTaskStore()
const { confirm } = useConfirm()
const { deleteGroupWithConfirm, error: deletionError } = useGroupDeletion()
const { selectedTask, isDetailOpen, handleDetailOpenChange, handleUpdateTask, handleUpdateChecklist, handleUpdatePomodoroConfig, handleDeleteFromDialog } = useTaskDetailHandlers(tasks, confirm)
const projectId = computed(() => String(route.params.projectId ?? ''))
const groupId = computed(() => String(route.params.groupId ?? ''))
const group = computed(() => findGroup(groups.groupsOf(projectId.value), groupId.value))
const state = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')
const error = ref('')
const retry = ref(0)

watch([projectId, groupId, retry], async ([pid, gid], _, onCleanup) => {
  let active = true
  onCleanup(() => {
    active = false
  })
  state.value = 'loading'
  error.value = ''
  deletionError.value = null
  isDetailOpen.value = false
  try {
    const [projectResponse, groupResponse, releaseResponse] = await Promise.all([
      projectsApi.fetchProject(pid),
      groupsApi.fetchGroups(pid),
      releasesApi.fetchReleases(pid),
      tasks.fetchTasks().then(() => {
        if (tasks.error)
          throw new Error(tasks.error)
      }),
    ])
    if (!active)
      return
    groups.trees[pid] = groupResponse.data
    releases.lists[pid] = releaseResponse.data
    const project = projectResponse.data
    const index = projects.projects.findIndex(p => p.id === pid)
    if (index < 0)
      projects.projects.push(project)
    else projects.projects[index] = project
    state.value = findGroup(groupResponse.data, gid) ? 'ready' : 'missing'
  }
  catch (err) {
    if (!active)
      return
    const status = (err as { response?: { status?: number } }).response?.status
    if (status === 404) {
      state.value = 'missing'
    }
    else {
      state.value = 'error'
      error.value = apiErrorMessage(err, 'Не удалось загрузить группу')
    }
  }
}, { immediate: true })

async function removeGroup() {
  const selected = group.value
  const pid = projectId.value
  const gid = groupId.value
  if (!selected)
    return
  if (await deleteGroupWithConfirm(pid, selected) && projectId.value === pid && groupId.value === gid)
    await router.push(`/tasks/project/${pid}`)
}
</script>

<template>
  <AppHeader :title="state === 'ready' ? (group?.type === 'story' ? 'История' : 'Эпик') : 'Группа'" :on-menu-click="openSidebar" />
  <PageContainer class="min-w-0">
    <p v-if="deletionError" role="alert" class="mb-4 text-sm text-destructive">
      {{ deletionError }}
    </p>
    <p v-if="state === 'loading'" role="status" class="p-5 text-muted-foreground">
      Загрузка…
    </p>
    <div v-else-if="state === 'error'" class="space-y-4 p-5">
      <p role="alert" class="text-destructive">
        {{ error }}
      </p>
      <Button variant="outline" @click="retry++">
        Повторить
      </Button>
    </div>
    <div v-else-if="state === 'missing'" class="space-y-4 p-5">
      <h1 class="text-xl font-semibold">
        Группа не найдена
      </h1>
      <p class="text-sm text-muted-foreground">
        История или эпик удалены либо недоступны в этом проекте.
      </p>
      <RouterLink :to="`/tasks/project/${projectId}`" class="text-sm text-primary hover:underline">
        К проекту
      </RouterLink>
    </div>
    <GroupDetailContent
      v-else
      :key="`${projectId}/${groupId}`"
      :project-id="projectId"
      :group-id="groupId"
      presentation="page"
      class="rounded-xl border border-border/60"
      @delete="removeGroup"
    />
    <TaskDetailDialog
      :task="selectedTask"
      :open="isDetailOpen"
      @update:open="handleDetailOpenChange"
      @delete="handleDeleteFromDialog"
      @update="handleUpdateTask"
      @update:checklist="handleUpdateChecklist"
      @update:pomodoro-config="handleUpdatePomodoroConfig"
    />
  </PageContainer>
</template>
