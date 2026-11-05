<script setup lang="ts">
import type { UpdateGroupPayload } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
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
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { ContentEditableInput } from '@/components/ui/content-editable-input'
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
import { taskLinkPath } from '@/features/tasks/lib/task-link'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { apiErrorMessage } from '../lib/api-error'
import { groupLinkPath } from '../lib/group-link'
import { groupPath, groupProgress } from '../lib/group-tree'
import { useGroupStore } from '../model/group-store'
import { useProjectStore } from '../model/project-store'
import { useReleaseStore } from '../model/release-store'
import ColorPicker from './ColorPicker.vue'
import GroupLinkActions from './GroupLinkActions.vue'
import ReleasePicker from './ReleasePicker.vue'
import StoryPlanningFields from './StoryPlanningFields.vue'

const props = withDefaults(defineProps<{ projectId: string, groupId: string, presentation?: 'page' | 'preview' }>(), { presentation: 'preview' })

const emit = defineEmits<{ close: [], openGroup: [id: string], openTask: [task: Task], delete: [] }>()

function parseGroupDate(value: string | null): Date | undefined {
  if (!value)
    return undefined
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, day)
}

const saveError = ref('')
const groupStore = useGroupStore()
const projectStore = useProjectStore()
const taskStore = useTaskStore()
const releaseStore = useReleaseStore()
const releaseError = ref<string | null>(null)
const savingRelease = ref(false)
const { tasks } = storeToRefs(taskStore)
const projectId = computed(() => props.projectId)
const groupId = computed(() => props.groupId)

const tree = computed(() => (projectId.value ? groupStore.groupsOf(projectId.value) : []))
const path = computed(() => (groupId.value ? groupPath(tree.value, groupId.value) : null))
const epic = computed(() => path.value?.epic ?? null)
const story = computed(() => path.value?.story ?? null)
const group = computed(() => story.value ?? epic.value)
const storyReleased = computed(() => releaseStore.releasesOf(projectId.value ?? '').some(r => r.id === story.value?.releaseId && r.status === 'released'))

const projectTitle = computed(() =>
  projectId.value ? (projectStore.projectMap.get(projectId.value)?.title ?? 'Проект') : 'Проект',
)

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

function openGroupId(id: string) {
  emit('openGroup', id)
}

function handleOpenTask(task: Task) {
  emit('openTask', task)
}

async function saveGroup(patch: UpdateGroupPayload) {
  if (!group.value)
    return
  saveError.value = ''
  try {
    await groupStore.updateGroup(props.projectId, group.value.id, patch)
  }
  catch (err) {
    saveError.value = apiErrorMessage(err, 'Не удалось сохранить изменения')
  }
}

const titleRef = ref<InstanceType<typeof ContentEditableInput> | null>(null)
const localTitle = ref('')
const localDescription = ref('')

watch(group, (g) => {
  localTitle.value = g?.title ?? ''
  localDescription.value = g?.description ?? ''
}, { immediate: true })

function commitTitle() {
  if (!group.value || !projectId.value)
    return
  if (localTitle.value === '') {
    localTitle.value = group.value.title
    return
  }
  if (localTitle.value !== group.value.title)
    saveGroup({ title: localTitle.value })
}

function commitDescription() {
  if (!group.value || !projectId.value)
    return
  const value = localDescription.value.length > 0 ? localDescription.value : null
  if (value !== (group.value.description ?? null))
    saveGroup({ description: value })
}

async function handleToggleDone() {
  if (!group.value || !projectId.value)
    return
  await saveGroup({ status: group.value.status === 'done' ? 'open' : 'done' })
}

const progress = computed(() => (group.value ? groupProgress(group.value, tasks.value) : { done: 0, total: 0 }))
const progressPercent = computed(() =>
  progress.value.total > 0 ? Math.round((progress.value.done / progress.value.total) * 100) : 0,
)

async function handleSetColor(color: string | null) {
  if (!epic.value || !projectId.value)
    return
  await saveGroup({ color })
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
  await saveGroup(field === 'startDate' ? { startDate: value } : { dueDate: value })
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
  <section class="flex min-h-0 min-w-0 flex-col">
    <div class="flex items-center justify-between px-5 py-3 border-b border-border/60">
      <div class="flex items-center gap-1.5 min-w-0 text-[11px] text-muted-foreground">
        <FolderOpen :size="11" class="shrink-0" />
        <RouterLink v-if="presentation === 'page'" :to="`/tasks/project/${projectId}`" class="truncate hover:underline">
          {{ projectTitle }}
        </RouterLink>
        <span v-else class="truncate">{{ projectTitle }}</span>
        <template v-if="story && epic">
          <ChevronRight :size="11" class="shrink-0" />
          <RouterLink v-if="presentation === 'page' && groupLinkPath(projectId, epic.id)" :to="groupLinkPath(projectId, epic.id)!" class="truncate hover:underline">
            {{ epic.title }}
          </RouterLink>
          <button
            v-else
            type="button"
            class="truncate hover:text-foreground hover:underline cursor-pointer"
            @click="openGroupId(epic.id)"
          >
            {{ epic.title }}
          </button>
        </template>
      </div>
      <div class="flex items-center gap-0.5 shrink-0">
        <GroupLinkActions v-if="group" :project-id="projectId" :group-id="groupId" :type="group.type" />
        <DropdownMenu v-if="group">
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon-sm" aria-label="Действия с группой" class="text-muted-foreground hover:text-foreground">
              <EllipsisVertical :size="16" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              class="text-destructive focus:text-destructive focus:bg-destructive/10"
              @click="emit('delete')"
            >
              <Trash2 :size="14" class="mr-2" />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button v-if="presentation === 'preview'" variant="ghost" size="icon-sm" aria-label="Закрыть" class="text-muted-foreground hover:text-foreground" @click="emit('close')">
          <X :size="16" />
        </Button>
      </div>
    </div>

    <p v-if="saveError" role="alert" class="px-5 py-2 text-sm text-destructive">
      {{ saveError }}
    </p>
    <div v-if="group" class="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row" :class="presentation === 'preview' ? 'overflow-y-auto' : ''">
      <div class="min-w-0 flex-1 space-y-5 px-4 py-5 sm:px-7">
        <ContentEditableInput
          ref="titleRef"
          v-model="localTitle"
          placeholder="Без названия"
          class="break-words [overflow-wrap:anywhere] text-xl font-semibold rounded-md cursor-text"
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
              <component
                :is="presentation === 'page' && groupLinkPath(projectId, s.id) ? RouterLink : 'button'"
                v-for="s in sortedStories"
                :key="s.id"
                :to="presentation === 'page' ? groupLinkPath(projectId, s.id) : undefined"
                type="button"
                class="w-full flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors text-left cursor-pointer"
                @click="presentation === 'preview' && openGroupId(s.id)"
              >
                <span class="flex-1 min-w-0 truncate text-sm">{{ s.title }}</span>
                <span v-if="s.status === 'done'" class="text-[11px] text-muted-foreground shrink-0">закрыта</span>
                <span class="text-[11px] tabular-nums text-muted-foreground shrink-0">
                  {{ groupProgress(s, tasks).done }} из {{ groupProgress(s, tasks).total }}
                </span>
              </component>
            </div>
          </template>

          <span class="text-sm font-medium text-foreground/90">{{ story ? 'Задачи' : 'Задачи эпика' }}</span>
          <div class="space-y-0.5">
            <component
              :is="presentation === 'page' && taskLinkPath(task.id) ? RouterLink : 'button'"
              v-for="task in ownTasks"
              :key="task.id"
              :to="presentation === 'page' ? taskLinkPath(task.id) : undefined"
              type="button"
              class="w-full flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors text-left cursor-pointer"
              @click="presentation === 'preview' && handleOpenTask(task)"
            >
              <span class="flex-1 min-w-0 truncate text-sm" :class="[task.completed && 'line-through text-muted-foreground']">
                {{ task.title }}
              </span>
            </component>
          </div>
        </div>
      </div>

      <div class="min-w-0 w-full shrink-0 border-t border-border/60 bg-muted/30 lg:w-[300px] lg:border-l lg:border-t-0">
        <StoryPlanningFields v-if="story" :story="story" />
        <div v-else class="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
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
          :model-value="story.releaseId ?? null"
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
  </section>
</template>
