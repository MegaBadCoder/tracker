<script setup lang="ts">
import type { Task } from '@/features/tasks/model/types'
import { startOfDay } from 'date-fns'
import { ChevronRight } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, inject, onMounted, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import PageContainer from '@/components/PageContainer.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNow } from '@/composables/useNow'
import { useProjectStore } from '@/features/projects/model/project-store'
import { toTimerTask, useTimerStore } from '@/features/task-timer'
import { formatDate, formatTaskCount } from '@/features/tasks/lib/formatters'
import { splitTodayBuckets } from '@/features/tasks/lib/today'
import { useTaskDetailHandlers } from '@/features/tasks/lib/use-task-detail-handlers'
import { useTaskStore } from '@/features/tasks/model/task-store'
import TaskCard from '@/features/tasks/ui/TaskCard.vue'
import TaskDetailDialog from '@/features/tasks/ui/TaskDetailDialog.vue'
import TaskForm from '@/features/tasks/ui/TaskForm.vue'

const openSidebar = inject<() => void>('openSidebar')

const taskStore = useTaskStore()
const { tasks, loading, error } = storeToRefs(taskStore)
const { fetchTasks, createTask, toggleTask, deleteTask } = taskStore

const projectStore = useProjectStore()
const timerStore = useTimerStore()
const { confirm } = useConfirm()

// Минутный тик: экран сам переживает полночь — вчерашняя группа наполняется,
// сегодняшняя очищается без перезагрузки страницы.
const now = useNow()

const buckets = computed(() => splitTodayBuckets(tasks.value, now.value))
const totalCount = computed(() => buckets.value.overdue.length + buckets.value.today.length)

const overdueCollapsed = ref(false)
const todayCollapsed = ref(false)

const taskFormRef = ref<InstanceType<typeof TaskForm> | null>(null)
const isCreatingTask = ref(false)

// Полночь у пользователя, пересчитывается вместе с `now` — форма не застревает
// на вчерашней дате в открытой вкладке.
const todayStart = computed(() => startOfDay(now.value))

const todayLabel = computed(
  () => `${formatDate(now.value, 'd MMM')} · Сегодня · ${formatDate(now.value, 'EEEE')}`,
)

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

  timerStore.startTask(toTimerTask(task))
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
  <AppHeader title="Сегодня" :on-menu-click="openSidebar" />
  <PageContainer>
    <p class="mb-6 text-sm text-muted-foreground">
      {{ formatTaskCount(totalCount) }}
    </p>

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
      <button
        class="mt-2 px-3 py-1 bg-destructive/20 text-destructive rounded hover:bg-destructive/30"
        @click="fetchTasks"
      >
        Повторить
      </button>
    </div>

    <template v-else>
      <div v-if="totalCount === 0" class="px-4 py-6 text-center text-muted-foreground">
        На сегодня задач нет.
      </div>

      <div v-else class="space-y-6">
        <!-- Просрочено: секции нет вовсе, когда нечего показывать -->
        <section v-if="buckets.overdue.length > 0">
          <div class="flex items-center gap-2 px-4 py-1.5 text-xs font-medium uppercase tracking-wide">
            <button
              class="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              :aria-expanded="!overdueCollapsed"
              @click="overdueCollapsed = !overdueCollapsed"
            >
              <ChevronRight
                :size="14"
                class="transition-transform duration-150"
                :class="!overdueCollapsed && 'rotate-90'"
              />
              <span>Просрочено</span>
              <span class="text-muted-foreground/60">{{ buckets.overdue.length }}</span>
            </button>
          </div>
          <div v-if="!overdueCollapsed" role="list" class="divide-y divide-border">
            <TaskCard
              v-for="task in buckets.overdue"
              :key="task.id"
              :task="task"
              :project-name="getProjectName(task)"
              @toggle="handleToggleTask"
              @show-timer="handleShowTimer"
              @delete="handleDeleteTask"
              @open="handleOpenTask"
            />
          </div>
        </section>

        <section>
          <div class="flex items-center gap-2 px-4 py-1.5 text-xs font-medium uppercase tracking-wide">
            <button
              class="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              :aria-expanded="!todayCollapsed"
              @click="todayCollapsed = !todayCollapsed"
            >
              <ChevronRight
                :size="14"
                class="transition-transform duration-150"
                :class="!todayCollapsed && 'rotate-90'"
              />
              <span class="capitalize">{{ todayLabel }}</span>
              <span class="text-muted-foreground/60">{{ buckets.today.length }}</span>
            </button>
          </div>
          <div v-if="!todayCollapsed">
            <div v-if="buckets.today.length === 0" class="px-4 py-3 text-sm text-muted-foreground/60">
              На сегодня ничего не запланировано.
            </div>
            <div v-else role="list" class="divide-y divide-border">
              <TaskCard
                v-for="task in buckets.today"
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
        </section>
      </div>

      <!-- Новая задача попадает прямо в «Сегодня»: дата предзаполнена -->
      <div class="mt-6">
        <TaskForm
          ref="taskFormRef"
          :loading="isCreatingTask"
          :default-due-date="todayStart"
          @submit="handleAddTask as any"
        />
      </div>
    </template>
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
