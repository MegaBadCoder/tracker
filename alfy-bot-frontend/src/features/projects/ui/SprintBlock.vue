<script setup lang="ts">
import type { BacklogStory, EpicFilter } from '../lib/backlog-stories'
import type { Sprint } from '../model/types'
import type { Task } from '@/features/tasks/model/types'
import { Ellipsis, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import draggable from 'vuedraggable'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDate } from '@/features/tasks/lib/formatters'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { backlogStories, standaloneBacklogTasks } from '../lib/backlog-stories'
import { parseLocalDate, sprintProgress, sprintTasks } from '../lib/sprint'
import { useGroupStore } from '../model/group-store'
import { useSprintStore } from '../model/sprint-store'
import BacklogStoryRow from './BacklogStoryRow.vue'
import BacklogTaskRow from './BacklogTaskRow.vue'
import InlineTitleInput from './InlineTitleInput.vue'

/**
 * Блок вкладки «Бэклог»: один спринт проекта или сам бэклог (`sprint = null`).
 * Кнопки действий со спринтом только эмитят события; показ управляется
 * пропсами `canStart` и `canManage`, а допустимость по статусу проверяется здесь.
 */
const props = withDefaults(defineProps<{
  /** Id проекта, которому принадлежит блок. */
  projectId: string
  /** Спринт блока; `null` — бэклог проекта. */
  sprint: Sprint | null
  /** Задачи, показываемые в блоке (уже отфильтрованные по настройкам проекта). */
  tasks: Task[]
  /** Выбранный эпик; all показывает всё, none — задачи без эпика. */
  epicFilter?: EpicFilter
  /** Показывать завершённые пустые истории. */
  showCompleted?: boolean
  /** Разрешает кнопку «Начать спринт» (показывается только у запланированного спринта без активного). */
  canStart?: boolean
  /** Разрешает «Завершить» у активного спринта и меню «Изменить»/«Удалить» у запланированного. */
  canManage?: boolean
  /** В проекте уже есть активный спринт — запускать второй нельзя. */
  hasActiveSprint?: boolean
}>(), {
  epicFilter: 'all',
  showCompleted: false,
  canStart: false,
  canManage: false,
  hasActiveSprint: false,
})

const emit = defineEmits<{
  /** Нажата «Начать спринт». */
  start: []
  /** Нажата «Завершить». */
  complete: []
  /** Выбран пункт «Изменить». */
  edit: []
  /** Выбран пункт «Удалить». */
  delete: []
  /** Задача перенесена в этот блок или выбрана в меню «В спринт…»: id задачи и id спринта (`null` — бэклог). */
  moveTask: [taskId: string, sprintId: string | null]
  moveStory: [storyId: string, sprintId: string | null]
  /** Введено название новой задачи. */
  createTask: [title: string]
  /** Создание задачи с группой истории в спринте текущего блока. */
  createStoryTask: [groupId: string, title: string]
  /** Клик по строке задачи. */
  openTask: [task: Task]
  /** Смена отметки выполнения задачи. */
  toggleTask: [id: string]
}>()

const sprintStore = useSprintStore()
const taskStore = useTaskStore()
const groupStore = useGroupStore()
const tree = computed(() => groupStore.groupsOf(props.projectId))
const closedSprintIds = computed(() => new Set(sprintStore.sprintsOf(props.projectId).filter(s => s.status === 'closed').map(s => s.id)))
const planningTasks = computed(() => taskStore.tasks.filter(t => t.projectId === props.projectId && !closedSprintIds.value.has(t.sprintId ?? '')))
const stories = computed(() => backlogStories(tree.value, props.tasks, planningTasks.value, props.sprint?.id ?? null, props.epicFilter, props.showCompleted))
const standaloneTasks = computed(() => standaloneBacklogTasks(props.tasks, tree.value))

const addingTask = ref(false)
const keepFocusOnClose = ref(false)

const showStart = computed(() =>
  props.canStart && props.sprint?.status === 'planned' && !props.hasActiveSprint,
)
const showComplete = computed(() => props.canManage && props.sprint?.status === 'active')
const showManage = computed(() => props.canManage && props.sprint?.status === 'planned')

const moveTargets = computed(() => {
  const active = sprintStore.activeSprintOf(props.projectId)
  return [...(active ? [active] : []), ...sprintStore.plannedSprintsOf(props.projectId)]
})

const title = computed(() => props.sprint?.name ?? 'Бэклог')

const counter = computed(() => {
  if (props.sprint) {
    const { done, total } = sprintProgress(taskStore.tasks, props.sprint.id)
    return `${done} из ${total} готово`
  }
  return String(sprintTasks(taskStore.tasks, null, props.projectId).length)
})

const dates = computed(() => {
  const { startDate, endDate } = props.sprint ?? {}
  if (!startDate || !endDate)
    return null
  return `${formatDate(parseLocalDate(startDate), 'd MMM')} – ${formatDate(parseLocalDate(endDate), 'd MMM')}`
})

function handleChange(event: { added?: { element: Task } }) {
  if (event.added)
    emit('moveTask', event.added.element.id, props.sprint?.id ?? null)
}

function handleStoryChange(event: { added?: { element: { story: { id: string } } } }) {
  if (event.added)
    emit('moveStory', event.added.element.story.id, props.sprint?.id ?? null)
}

function handleEdit() {
  keepFocusOnClose.value = true
  emit('edit')
}

function onCloseAutoFocus(event: Event) {
  if (!keepFocusOnClose.value)
    return
  keepFocusOnClose.value = false
  event.preventDefault()
}

function handleCreateTask(taskTitle: string) {
  addingTask.value = false
  emit('createTask', taskTitle)
}
</script>

<template>
  <section class="rounded-lg border border-border bg-muted/20" :data-sprint-id="sprint?.id ?? 'backlog'">
    <header class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-2">
      <h2 class="text-sm font-semibold">
        {{ title }}
      </h2>
      <span v-if="dates" class="text-xs text-muted-foreground">{{ dates }}</span>
      <span v-if="sprint?.goal" class="min-w-0 max-w-full truncate text-xs text-muted-foreground">{{ sprint.goal }}</span>
      <span class="text-xs text-muted-foreground" data-testid="sprint-counter">{{ counter }}</span>
      <span v-if="epicFilter !== 'all'" class="text-xs text-muted-foreground" data-testid="visible-count">Задач по фильтру: {{ tasks.length }}</span>
      <div class="ml-auto flex items-center gap-1">
        <Button v-if="showStart" size="sm" variant="outline" @click="emit('start')">
          Начать спринт
        </Button>
        <Button v-if="showComplete" size="sm" variant="outline" @click="emit('complete')">
          Завершить
        </Button>
        <DropdownMenu v-if="showManage">
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-muted-foreground hover:text-foreground"
              aria-label="Действия со спринтом"
            >
              <Ellipsis :size="16" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" @close-auto-focus="onCloseAutoFocus">
            <DropdownMenuItem @click="handleEdit">
              <Pencil :size="14" class="mr-2" />
              Изменить
            </DropdownMenuItem>
            <DropdownMenuItem
              class="text-destructive focus:text-destructive focus:bg-destructive/10"
              @click="emit('delete')"
            >
              <Trash2 :size="14" class="mr-2" />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    <draggable
      :model-value="stories"
      :item-key="(entry: BacklogStory) => entry.story.id"
      :group="{ name: 'sprint-stories' }"
      handle=".story-drag-handle"
      :sort="false"
      :animation="150"
      ghost-class="opacity-30"
      class="flex min-h-16 flex-col gap-1.5 p-2"
      :class="stories.length === 0 && 'm-2 rounded-md border border-dashed border-border/70'"
      @change="handleStoryChange"
    >
      <template #item="{ element: entry }">
        <BacklogStoryRow
          :entry="entry"
          :sprint-id="sprint?.id ?? null"
          :sprints="moveTargets"
          @create-task="(groupId, taskTitle) => emit('createStoryTask', groupId, taskTitle)"
          @open-task="emit('openTask', $event)"
          @toggle-task="emit('toggleTask', $event)"
          @move-task="(taskId, sprintId) => emit('moveTask', taskId, sprintId)"
          @move-story="(storyId, sprintId) => emit('moveStory', storyId, sprintId)"
        />
      </template>
      <template #footer>
        <p v-if="stories.length === 0" class="px-2 py-2 text-center text-xs text-muted-foreground">
          Перетащите историю сюда
        </p>
      </template>
    </draggable>

    <draggable
      :model-value="standaloneTasks"
      item-key="id"
      :group="{ name: 'sprint-backlog' }"
      :sort="false"
      :animation="150"
      ghost-class="opacity-30"
      class="flex min-h-12 flex-col p-1"
      @change="handleChange"
    >
      <template #item="{ element }">
        <BacklogTaskRow
          :task="element"
          :sprints="moveTargets"
          @open="emit('openTask', $event)"
          @toggle="emit('toggleTask', $event)"
          @move="emit('moveTask', element.id, $event)"
        />
      </template>
      <template #footer>
        <p v-if="tasks.length === 0 && stories.length === 0" class="px-3 py-3 text-xs text-muted-foreground">
          Нет задач. Перетащите задачу сюда или создайте новую.
        </p>
      </template>
    </draggable>

    <div class="border-t border-border px-3 py-2">
      <button
        v-if="!addingTask"
        class="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        @click="addingTask = true"
      >
        <Plus :size="14" />
        задача
      </button>
      <InlineTitleInput
        v-else
        placeholder="Название задачи"
        @submit="handleCreateTask"
        @cancel="addingTask = false"
      />
    </div>
  </section>
</template>
