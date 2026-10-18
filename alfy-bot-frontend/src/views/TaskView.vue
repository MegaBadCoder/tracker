<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import PageContainer from '@/components/PageContainer.vue'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/composables/useConfirm'
import { useTaskDetailHandlers } from '@/features/tasks/lib/use-task-detail-handlers'
import { useTaskStore } from '@/features/tasks/model/task-store'
import TaskDetailDialog from '@/features/tasks/ui/TaskDetailDialog.vue'

const route = useRoute()
const router = useRouter()
const openSidebar = inject<() => void>('openSidebar')
const taskStore = useTaskStore()
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
const taskId = computed(() => String(route.params.taskId ?? ''))
const loading = ref(false)
const error = ref<string | null>(null)
const notFound = ref(false)
const deleting = ref(false)
let request = 0
const visibleTask = computed(() => selectedTask.value?.id === taskId.value ? selectedTask.value : null)

async function loadTask() {
  const current = ++request
  const id = taskId.value
  selectedTask.value = null
  isDetailOpen.value = false
  loading.value = true
  error.value = null
  notFound.value = false
  try {
    const task = await taskStore.fetchTask(id)
    if (current !== request)
      return
    handleOpenTask(task)
  }
  catch (cause) {
    if (current !== request)
      return
    notFound.value = (cause as { response?: { status?: number } })?.response?.status === 404
    error.value = notFound.value ? 'Задача не найдена или недоступна' : 'Не удалось загрузить задачу'
  }
  finally {
    if (current === request)
      loading.value = false
  }
}

function leaveTask(projectId = visibleTask.value?.projectId) {
  void router.push(projectId ? { name: 'tasks-project', params: { projectId } } : { name: 'tasks' })
}

function handleOpenChange(open: boolean) {
  isDetailOpen.value = open
  if (!open && !deleting.value)
    leaveTask()
}

async function deleteTask(id: string) {
  const previous = visibleTask.value
  const current = request
  deleting.value = true
  try {
    await handleDeleteFromDialog(id)
    if (current !== request)
      return
    if (!taskStore.tasks.some(task => task.id === id))
      leaveTask(previous?.projectId)
    else if (previous)
      handleOpenTask(previous)
  }
  catch {
    if (current !== request)
      return
    error.value = 'Не удалось удалить задачу. Попробуйте ещё раз.'
  }
  finally {
    deleting.value = false
  }
}

watch(taskId, loadTask, { immediate: true })
onBeforeUnmount(() => {
  request++
})
</script>

<template>
  <AppHeader title="Задача" :on-menu-click="openSidebar" />
  <PageContainer>
    <p v-if="loading" role="status" class="py-8 text-muted-foreground">
      Загрузка задачи...
    </p>
    <div v-else-if="error" class="space-y-4 py-8">
      <p role="alert">
        {{ error }}
      </p>
      <Button v-if="!notFound" variant="outline" @click="loadTask">
        Повторить
      </Button>
      <Button variant="ghost" @click="leaveTask()">
        К задачам
      </Button>
    </div>
    <p v-else class="py-8 text-muted-foreground">
      {{ visibleTask?.title || 'Задача' }}
    </p>
  </PageContainer>
  <TaskDetailDialog
    v-if="visibleTask"
    :key="visibleTask.id"
    :task="visibleTask"
    :open="isDetailOpen"
    @update:open="handleOpenChange"
    @update="handleUpdateTask"
    @update:checklist="handleUpdateChecklist"
    @update:pomodoro-config="handleUpdatePomodoroConfig"
    @delete="deleteTask"
  />
</template>
