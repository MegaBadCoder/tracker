<script setup lang="ts">
import type { Task } from '@/features/tasks/model/types'
import { useMediaQuery } from '@vueuse/core'
import {
  CalendarIcon,
  ChevronRight,
  EllipsisVertical,
  FolderOpen,
  Trash2,
  X,
} from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { ContentEditableInput } from '@/components/ui/content-editable-input'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { intlLocale, weekStartsOn } from '@/composables/useLocale'
import { toLocalISODate } from '@/features/goals/lib/dates'
import { toCalendarDateValue, toDate } from '@/features/tasks/lib/dateTime'
import { formatDueDate } from '@/features/tasks/lib/formatters'
import { openTaskDetail } from '@/features/tasks/lib/task-detail-navigation'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { apiErrorMessage } from '../lib/api-error'
import { findGroup, groupPath, groupProgress } from '../lib/group-tree'
import { useGroupDeletion } from '../lib/use-group-deletion'
import { useGroupStore } from '../model/group-store'
import { useProjectStore } from '../model/project-store'
import { useReleaseStore } from '../model/release-store'
import { useGroupDetail } from '../model/use-group-detail'
import ColorPicker from './ColorPicker.vue'
import ReleasePicker from './ReleasePicker.vue'

function parseGroupDate(value: string | null): Date | undefined {
  if (!value)
    return undefined
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, day)
}

const groupDetail = useGroupDetail()
const groupStore = useGroupStore()
const projectStore = useProjectStore()
const taskStore = useTaskStore()
const releaseStore = useReleaseStore()
const releaseError = ref<string | null>(null)
const savingRelease = ref(false)
const { tasks } = storeToRefs(taskStore)
const { deleteGroupWithConfirm } = useGroupDeletion()

const isDesktop = useMediaQuery('(min-width: 640px)')
const isMobile = computed(() => !isDesktop.value)

const target = computed(() => groupDetail.current.value)
const isOpen = computed(() => target.value !== null)
const projectId = computed(() => target.value?.projectId ?? null)
const groupId = computed(() => target.value?.groupId ?? null)

const tree = computed(() => (projectId.value ? groupStore.groupsOf(projectId.value) : []))
const path = computed(() => (groupId.value ? groupPath(tree.value, groupId.value) : null))
const epic = computed(() => path.value?.epic ?? null)
const story = computed(() => path.value?.story ?? null)
const group = computed(() => story.value ?? epic.value)
const storyReleased = computed(() => releaseStore.releasesOf(projectId.value ?? '').some(r => r.id === story.value?.releaseId && r.status === 'released'))

const projectTitle = computed(() =>
  projectId.value ? (projectStore.projectMap.get(projectId.value)?.title ?? 'Проект') : 'Проект',
)

watch(target, async (value) => {
  if (!value)
    return
  releaseError.value = null
  await Promise.all([groupStore.ensureGroups(value.projectId), releaseStore.ensureReleases(value.projectId)])
  if (!findGroup(groupStore.groupsOf(value.projectId), value.groupId))
    groupDetail.close()
}, { immediate: true })

async function handleStoryRelease(releaseId: string | null) {
  if (!story.value || !projectId.value)
    return
  releaseError.value = null
  savingRelease.value = true
  try {
    await releaseStore.setStoryRelease(projectId.value, story.value.id, releaseId)
  }
  catch (err) {
    releaseError.value = apiErrorMessage(err, 'Не удалось назначить релиз истории')
  }
  finally {
    savingRelease.value = false
  }
}

function onOpenChange(value: boolean) {
  if (!value)
    groupDetail.close()
}

function openGroupId(id: string) {
  if (projectId.value)
    groupDetail.open(projectId.value, id)
}

function handleOpenTask(task: Task) {
  groupDetail.close()
  openTaskDetail(task)
}

async function handleDelete() {
  if (!group.value || !projectId.value)
    return
  const toDelete = group.value
  const toDeleteProjectId = projectId.value
  groupDetail.close()
  await deleteGroupWithConfirm(toDeleteProjectId, toDelete)
}

const titleRef = ref<InstanceType<typeof ContentEditableInput> | null>(null)
const localTitle = ref('')
const localDescription = ref('')

watch(group, (g) => {
  localTitle.value = g?.title ?? ''
  localDescription.value = g?.description ?? ''
})

function commitTitle() {
  if (!group.value || !projectId.value)
    return
  if (localTitle.value === '') {
    localTitle.value = group.value.title
    return
  }
  if (localTitle.value !== group.value.title)
    groupStore.updateGroup(projectId.value, group.value.id, { title: localTitle.value })
}

function commitDescription() {
  if (!group.value || !projectId.value)
    return
  const value = localDescription.value.length > 0 ? localDescription.value : null
  if (value !== (group.value.description ?? null))
    groupStore.updateGroup(projectId.value, group.value.id, { description: value })
}

async function handleToggleDone() {
  if (!group.value || !projectId.value)
    return
  await groupStore.toggleGroupDone(projectId.value, group.value)
}

const progress = computed(() => (group.value ? groupProgress(group.value, tasks.value) : { done: 0, total: 0 }))
const progressPercent = computed(() =>
  progress.value.total > 0 ? Math.round((progress.value.done / progress.value.total) * 100) : 0,
)

async function handleSetColor(color: string | null) {
  if (!epic.value || !projectId.value)
    return
  await groupStore.updateGroup(projectId.value, epic.value.id, { color })
}

const startDateValue = computed(() => parseGroupDate(epic.value?.startDate ?? null))
const dueDateValue = computed(() => parseGroupDate(epic.value?.dueDate ?? null))
const startDateCalendarValue = computed(() => toCalendarDateValue(startDateValue.value))
const dueDateCalendarValue = computed(() => toCalendarDateValue(dueDateValue.value))

async function commitEpicDate(field: 'startDate' | 'dueDate', date: Date | undefined) {
  if (!epic.value || !projectId.value)
    return
  const value = date ? toLocalISODate(date) : null
  if (value === epic.value[field])
    return
  try {
    await groupStore.updateGroup(
      projectId.value,
      epic.value.id,
      field === 'startDate' ? { startDate: value } : { dueDate: value },
    )
  }
  catch (err) {
    console.error('Не удалось обновить дату эпика:', err)
  }
}

const startDateOpen = ref(false)
const dueDateOpen = ref(false)

function onStartDateChange(val: unknown) {
  startDateOpen.value = false
  commitEpicDate('startDate', toDate(val))
}

function onDueDateChange(val: unknown) {
  dueDateOpen.value = false
  commitEpicDate('dueDate', toDate(val))
}

const statusLabel = computed(() => {
  const done = group.value?.status === 'done'
  if (group.value?.type === 'epic')
    return done ? 'Закрыт' : 'Открыт'
  return done ? 'Закрыта' : 'Открыта'
})

const sortedStories = computed(() =>
  epic.value ? [...epic.value.children].sort((a, b) => a.order - b.order) : [],
)

const ownTasks = computed(() => {
  if (!group.value)
    return []
  return tasks.value
    .filter(t => t.groupId === group.value!.id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
})
</script>

<template>
  <Dialog :open="isOpen" @update:open="onOpenChange">
    <DialogContent
      class="flex flex-col gap-0 p-0 overflow-hidden [&>button:last-child]:hidden" :class="[
        isMobile
          ? 'inset-0 h-[100dvh] w-full max-w-none rounded-none translate-x-0 translate-y-0 left-0 top-0 border-0'
          : 'max-w-3xl h-[95vh]',
      ]"
    >
      <DialogTitle class="sr-only">
        {{ group?.title || (story ? 'История' : 'Эпик') }}
      </DialogTitle>

      <div class="flex items-center justify-between px-5 py-3 border-b border-border/60">
        <div class="flex items-center gap-1.5 min-w-0 text-[11px] text-muted-foreground">
          <FolderOpen :size="11" class="shrink-0" />
          <span class="truncate">{{ projectTitle }}</span>
          <template v-if="story && epic">
            <ChevronRight :size="11" class="shrink-0" />
            <button
              type="button"
              class="truncate hover:text-foreground hover:underline cursor-pointer"
              @click="openGroupId(epic.id)"
            >
              {{ epic.title }}
            </button>
          </template>
        </div>
        <div class="flex items-center gap-0.5 shrink-0">
          <DropdownMenu v-if="group">
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon-sm" aria-label="Действия с группой" class="text-muted-foreground hover:text-foreground">
                <EllipsisVertical :size="16" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                class="text-destructive focus:text-destructive focus:bg-destructive/10"
                @click="handleDelete"
              >
                <Trash2 :size="14" class="mr-2" />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DialogClose as-child>
            <Button variant="ghost" size="icon-sm" aria-label="Закрыть" class="text-muted-foreground hover:text-foreground">
              <X :size="16" />
            </Button>
          </DialogClose>
        </div>
      </div>

      <div v-if="group" class="flex overflow-hidden flex-1 min-h-0" :class="[isMobile ? 'flex-col overflow-y-auto' : 'flex-row']">
        <div class="flex-1 px-7 py-5 space-y-5">
          <ContentEditableInput
            ref="titleRef"
            v-model="localTitle"
            placeholder="Без названия"
            class="text-xl font-semibold rounded-md cursor-text"
            aria-label="Название группы"
            @blur="commitTitle"
            @keydown.enter.prevent="titleRef?.el?.blur()"
          />

          <Textarea
            v-model="localDescription"
            placeholder="Добавить описание..."
            class="min-h-24 text-sm"
            aria-label="Описание группы"
            @blur="commitDescription"
          />

          <div class="space-y-2.5">
            <template v-if="!story">
              <span class="text-sm font-medium text-foreground/90">Истории</span>
              <div class="space-y-0.5">
                <button
                  v-for="s in sortedStories"
                  :key="s.id"
                  type="button"
                  class="w-full flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors text-left cursor-pointer"
                  @click="openGroupId(s.id)"
                >
                  <span class="flex-1 min-w-0 truncate text-sm">{{ s.title }}</span>
                  <span v-if="s.status === 'done'" class="text-[11px] text-muted-foreground shrink-0">закрыта</span>
                  <span class="text-[11px] tabular-nums text-muted-foreground shrink-0">
                    {{ groupProgress(s, tasks).done }} из {{ groupProgress(s, tasks).total }}
                  </span>
                </button>
              </div>
            </template>

            <span class="text-sm font-medium text-foreground/90">{{ story ? 'Задачи' : 'Задачи эпика' }}</span>
            <div class="space-y-0.5">
              <button
                v-for="task in ownTasks"
                :key="task.id"
                type="button"
                class="w-full flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors text-left cursor-pointer"
                @click="handleOpenTask(task)"
              >
                <span class="flex-1 min-w-0 truncate text-sm" :class="[task.completed && 'line-through text-muted-foreground']">
                  {{ task.title }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div
          class="shrink-0 bg-muted/30" :class="[
            isMobile ? 'w-full border-t border-border/60' : 'sm:w-60 border-l border-border/60 overflow-y-auto',
          ]"
        >
          <div class="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
            <span class="text-[11px] text-muted-foreground/60 font-medium">Статус</span>
            <div class="flex items-center gap-2">
              <span class="text-[13px]">{{ statusLabel }}</span>
              <Switch :checked="group.status === 'done'" @update:checked="handleToggleDone" />
            </div>
          </div>

          <div class="px-4 py-2.5 border-b border-border/40 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-[11px] text-muted-foreground/60 font-medium">Прогресс</span>
              <span class="text-[11px] tabular-nums text-muted-foreground">{{ progress.done }} из {{ progress.total }} готово</span>
            </div>
            <div class="h-1 bg-muted rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-300" :class="[progressPercent === 100 ? 'bg-green-500' : 'bg-primary']"
                :style="{ width: `${progressPercent}%` }"
              />
            </div>
          </div>

          <ReleasePicker
            v-if="story && projectId"
            :project-id="projectId"
            :model-value="story.releaseId"
            :disabled="savingRelease || storyReleased"
            @update:model-value="handleStoryRelease"
          />
          <p v-if="releaseError" role="alert" class="px-4 py-2 text-xs text-destructive">
            {{ releaseError }}
          </p>

          <template v-if="!story && epic">
            <div class="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
              <span class="text-[11px] text-muted-foreground/60 font-medium">Цвет</span>
              <ColorPicker :model-value="epic.color" @update:model-value="handleSetColor" />
            </div>

            <Popover v-model:open="startDateOpen">
              <div class="relative border-b border-border/40">
                <PopoverTrigger as-child>
                  <button type="button" class="w-full px-4 py-2.5 text-left cursor-pointer hover:bg-muted/50 transition-colors">
                    <div class="flex items-center gap-2 mb-1">
                      <CalendarIcon :size="13" class="text-muted-foreground/60" />
                      <span class="text-[11px] text-muted-foreground/60 font-medium">Начало</span>
                    </div>
                    <div class="text-[13px] truncate" :class="[epic.startDate ? '' : 'text-muted-foreground/40']">
                      {{ startDateValue ? formatDueDate(startDateValue, { includeYear: true }) : 'Не задано' }}
                    </div>
                  </button>
                </PopoverTrigger>
                <button
                  v-if="epic.startDate"
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-sm text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  aria-label="Очистить дату начала"
                  @click.stop="commitEpicDate('startDate', undefined)"
                >
                  <X :size="14" />
                </button>
              </div>
              <PopoverContent class="w-auto p-0">
                <Calendar
                  :model-value="startDateCalendarValue"
                  :max-value="dueDateCalendarValue"
                  :locale="intlLocale"
                  :week-starts-on="weekStartsOn"
                  weekday-format="short"
                  @update:model-value="onStartDateChange"
                />
              </PopoverContent>
            </Popover>

            <Popover v-model:open="dueDateOpen">
              <div class="relative border-b border-border/40">
                <PopoverTrigger as-child>
                  <button type="button" class="w-full px-4 py-2.5 text-left cursor-pointer hover:bg-muted/50 transition-colors">
                    <div class="flex items-center gap-2 mb-1">
                      <CalendarIcon :size="13" class="text-muted-foreground/60" />
                      <span class="text-[11px] text-muted-foreground/60 font-medium">Срок</span>
                    </div>
                    <div class="text-[13px] truncate" :class="[epic.dueDate ? '' : 'text-muted-foreground/40']">
                      {{ dueDateValue ? formatDueDate(dueDateValue, { includeYear: true }) : 'Не задано' }}
                    </div>
                  </button>
                </PopoverTrigger>
                <button
                  v-if="epic.dueDate"
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-sm text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  aria-label="Очистить срок"
                  @click.stop="commitEpicDate('dueDate', undefined)"
                >
                  <X :size="14" />
                </button>
              </div>
              <PopoverContent class="w-auto p-0">
                <Calendar
                  :model-value="dueDateCalendarValue"
                  :min-value="startDateCalendarValue"
                  :locale="intlLocale"
                  :week-starts-on="weekStartsOn"
                  weekday-format="short"
                  @update:model-value="onDueDateChange"
                />
              </PopoverContent>
            </Popover>
          </template>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
