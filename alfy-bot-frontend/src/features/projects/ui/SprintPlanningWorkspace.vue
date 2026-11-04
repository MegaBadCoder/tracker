<script setup lang="ts">
import type { BoardGroup } from '../model/types'
import { ArrowRight, Search, Undo2 } from 'lucide-vue-next'
import { computed, ref, toRef, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useGroupStore } from '../model/group-store'
import { useSprintStore } from '../model/sprint-store'
import { useStoryWorkflowStore } from '../model/story-workflow-store'
import { usePlanningWorkspace } from '../model/use-planning-workspace'
import PlanningQueue from './PlanningQueue.vue'
import SprintCapacityBar from './SprintCapacityBar.vue'
import StoryWorkflowDialog from './StoryWorkflowDialog.vue'

const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{ openTask: [id: string], createSprint: [] }>()
const groups = useGroupStore()
const sprints = useSprintStore()
const workflow = useStoryWorkflowStore()
const selectedSprintId = ref<string | null>(null)
const projectId = toRef(props, 'projectId')
const { context, proposal, selectedTaskIds, selectedStoryIds, undoToken, busy, loading, error, notice, hasSelection, load, run, move, undo, propose, reorder } = usePlanningWorkspace(projectId, selectedSprintId)
const options = computed(() => sprints.sprintsOf(props.projectId).filter(sprint => sprint.status !== 'closed'))
const selectedSprint = computed(() => options.value.find(sprint => sprint.id === selectedSprintId.value))
const query = ref('')
const view = ref('all')
const statusFilter = ref('all')
const epicFilter = ref('all')
const unchangedSince = ref('')
const includeCompleted = ref(false)
const workflowOpen = ref(false)
const capacity = ref<number | string>('')
const reserve = ref<number | string>(0)
const goal = ref('')
const statuses = computed(() => workflow.statusesOf(props.projectId))
const stories = computed(() => groups.groupsOf(props.projectId).flatMap(epic => epic.children))
const today = computed(() => context.value?.today ?? null)
watch([projectId, options], () => {
  if (!options.value.some(s => s.id === selectedSprintId.value))
    selectedSprintId.value = options.value.find(s => s.status === 'planned')?.id ?? options.value[0]?.id ?? null
}, { immediate: true })
watch(projectId, (id) => {
  workflow.ensure(id)
  query.value = ''
  view.value = 'all'
  epicFilter.value = 'all'
  statusFilter.value = 'all'
}, { immediate: true })
watch([() => selectedSprint.value?.id, () => selectedSprint.value?.capacityMinutes, () => selectedSprint.value?.reserveMinutes, () => selectedSprint.value?.goal], () => {
  const sprint = selectedSprint.value
  capacity.value = sprint?.capacityMinutes ?? ''
  reserve.value = sprint?.reserveMinutes ?? 0
  goal.value = sprint?.goal ?? ''
}, { immediate: true })

function category(story: BoardGroup) {
  return statuses.value.find(status => status.id === story.workflowStatusId)?.category ?? (story.status === 'done' ? 'done' : 'open')
}

function matchesStory(story: BoardGroup) {
  if (view.value === 'archive' ? !story.archived : story.archived)
    return false
  if (!includeCompleted.value && story.status === 'done')
    return false
  const deferred = !!story.deferredUntil && today.value !== null && story.deferredUntil > today.value
  if (view.value === 'later' ? !deferred : deferred && view.value !== 'archive')
    return false
  if (view.value === 'ready' && (category(story) !== 'ready' || story.blockedReason || story.dependencyIds?.some(id => stories.value.find(s => s.id === id)?.status !== 'done')))
    return false
  if (view.value === 'refine' && category(story) !== 'open')
    return false
  if (statusFilter.value !== 'all' && story.workflowStatusId !== statusFilter.value)
    return false
  if (epicFilter.value !== 'all' && story.parentId !== epicFilter.value)
    return false
  if (unchangedSince.value && (!story.updatedAt || story.updatedAt.slice(0, 10) >= unchangedSince.value))
    return false
  return true
}

function tasksFor(sprintId: string | null, filtered: boolean) {
  const search = query.value.trim().toLocaleLowerCase()
  return (context.value?.tasks ?? []).filter(task => (task.sprintId ?? null) === sprintId).filter(task => includeCompleted.value || !task.completed).filter((task) => {
    if (!filtered)
      return true
    const story = stories.value.find(story => story.id === task.groupId)
    if (story && !matchesStory(story))
      return false
    if (!story && (view.value !== 'all' || statusFilter.value !== 'all'))
      return false
    if (!story && epicFilter.value !== 'all' && task.groupId !== epicFilter.value)
      return false
    if (unchangedSince.value && (!task.updatedAt || task.updatedAt.slice(0, 10) >= unchangedSince.value))
      return false
    return !search || `${task.title} ${story?.title ?? ''}`.toLocaleLowerCase().includes(search)
  }).sort((a, b) => a.order - b.order)
}

function storiesFor(sprintId: string | null, filtered: boolean) {
  const visibleTasks = tasksFor(sprintId, filtered)
  const search = query.value.trim().toLocaleLowerCase()
  return stories.value.filter(story => (filtered && (view.value === 'archive' || view.value === 'later')) || (story.sprintId ?? null) === sprintId || visibleTasks.some(task => task.groupId === story.id))
    .filter(story => !filtered || matchesStory(story))
    .filter(story => !filtered || !search || story.title.toLocaleLowerCase().includes(search) || visibleTasks.some(task => task.groupId === story.id))
    .sort((a, b) => a.order - b.order)
}

const backlogTasks = computed(() => tasksFor(null, true))
const backlogStories = computed(() => storiesFor(null, true))
const sprintTasks = computed(() => selectedSprintId.value ? tasksFor(selectedSprintId.value, false) : [])
const sprintStories = computed(() => selectedSprintId.value ? storiesFor(selectedSprintId.value, false) : [])
const selectedTasks = computed(() => (context.value?.tasks ?? []).filter(task => selectedTaskIds.value.includes(task.id) || (task.groupId && selectedStoryIds.value.includes(task.groupId))))
const selectionMinutes = computed(() => selectedTasks.value.reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0))
const selectionUnestimated = computed(() => selectedTasks.value.filter(task => task.estimateMinutes === null).length)
const missingDates = computed(() => unchangedSince.value ? (context.value?.tasks ?? []).filter(t => !t.updatedAt).length : 0)
const budgetInvalid = computed(() => (capacity.value !== '' && (!Number.isInteger(Number(capacity.value)) || Number(capacity.value) < 0)) || !Number.isInteger(Number(reserve.value)) || Number(reserve.value) < 0 || (capacity.value !== '' && Number(reserve.value) > Number(capacity.value)))

async function saveBudget() {
  const sprint = selectedSprint.value
  if (!sprint || budgetInvalid.value)
    return
  await run(async () => {
    await sprints.updateSprint(props.projectId, sprint.id, { capacityMinutes: capacity.value === '' ? null : Number(capacity.value), reserveMinutes: Number(reserve.value), goal: goal.value.trim() || null })
    await load()
  })
}

async function moveStory(story: BoardGroup, direction: -1 | 1) {
  const siblings = groups.groupsOf(props.projectId).find(epic => epic.id === story.parentId)?.children ?? []
  const ids = [...siblings].sort((a, b) => a.order - b.order).map(item => item.id)
  const index = ids.indexOf(story.id)
  if (index + direction < 0 || index + direction >= ids.length)
    return
  ids.splice(index, 1)
  ids.splice(index + direction, 0, story.id)
  await run(async () => {
    await groups.reorderGroups(props.projectId, ids)
  })
}

function titleOf(id: string) {
  return stories.value.find(story => story.id === id)?.title ?? context.value?.tasks.find(task => task.id === id)?.title ?? id
}
</script>

<template>
  <section class="space-y-4" aria-label="Планирование спринта">
    <div class="flex flex-wrap items-center gap-2">
      <label class="relative min-w-48 flex-1"><Search :size="15" class="absolute left-3 top-3 text-muted-foreground" /><Input v-model="query" type="search" placeholder="Поиск в бэклоге" aria-label="Поиск в бэклоге" class="pl-9" /></label>
      <select v-model="selectedSprintId" aria-label="Спринт для планирования" class="min-h-9 max-w-full rounded-md border border-input bg-background px-3 text-sm">
        <option :value="null" disabled>
          Выберите спринт
        </option><option v-for="sprint in options" :key="sprint.id" :value="sprint.id">
          {{ sprint.name }}{{ sprint.status === 'active' ? ' · активный' : '' }}
        </option>
      </select>
      <Button size="sm" variant="outline" @click="emit('createSprint')">
        Создать спринт
      </Button>
      <Button size="sm" variant="ghost" @click="workflowOpen = true">
        Статусы историй
      </Button>
    </div>
    <div class="flex flex-wrap gap-2" role="group" aria-label="Представление бэклога">
      <Button v-for="option in [{ id: 'all', label: 'Всё' }, { id: 'refine', label: 'Разобрать' }, { id: 'ready', label: 'Готово к работе' }, { id: 'later', label: 'Позже' }, { id: 'archive', label: 'Архив историй' }]" :key="option.id" size="sm" :variant="view === option.id ? 'secondary' : 'ghost'" :aria-pressed="view === option.id" @click="view = option.id">
        {{ option.label }}
      </Button>
    </div>
    <details class="rounded-lg border border-border px-3 py-2 text-sm">
      <summary class="cursor-pointer text-muted-foreground">
        Фильтры и пересмотр бэклога
      </summary><div class="mt-3 flex flex-wrap items-end gap-3">
        <label class="grid gap-1 text-xs">Эпик<select v-model="epicFilter" class="min-h-9 rounded-md border border-input bg-background px-2"><option value="all">Все эпики</option><option v-for="epic in groups.groupsOf(projectId)" :key="epic.id" :value="epic.id">{{ epic.title }}</option></select></label>
        <label class="grid gap-1 text-xs">Статус<select v-model="statusFilter" class="min-h-9 rounded-md border border-input bg-background px-2"><option value="all">Все статусы</option><option v-for="status in statuses" :key="status.id" :value="status.id">{{ status.name }}</option></select></label>
        <label class="grid gap-1 text-xs">Не менялись с<Input v-model="unchangedSince" type="date" aria-label="Не менялись с" /></label>
        <label class="flex min-h-9 items-center gap-2 text-xs"><input v-model="includeCompleted" type="checkbox" class="accent-primary">Показать выполненные</label>
      </div><p v-if="missingDates" class="mt-2 text-xs text-muted-foreground">
        У {{ missingDates }} задач нет даты изменения; они не входят в подборку забытых задач.
      </p>
    </details>
    <form v-if="selectedSprint" class="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-[1fr_auto_auto_auto]" @submit.prevent="saveBudget">
      <label class="grid gap-1.5 text-xs">Цель спринта<Input v-model="goal" placeholder="Какой результат получим" aria-label="Цель планирования" /></label>
      <label class="grid gap-1.5 text-xs">Доступно, мин<Input v-model="capacity" type="number" min="0" step="1" placeholder="Не задано" aria-label="Бюджет спринта в минутах" class="sm:w-32" /></label>
      <label class="grid gap-1.5 text-xs">Резерв, мин<Input v-model="reserve" type="number" min="0" step="1" aria-label="Резерв спринта в минутах" class="sm:w-28" /></label>
      <Button type="submit" variant="outline" :disabled="busy || budgetInvalid" class="self-end">
        Сохранить план
      </Button>
      <p v-if="budgetInvalid" role="alert" class="text-xs text-destructive sm:col-span-4">
        Укажите целое неотрицательное число минут. Резерв не должен превышать бюджет.
      </p>
    </form>
    <div class="sticky top-0 z-10 space-y-2 bg-background/95 py-2 backdrop-blur-sm">
      <SprintCapacityBar v-if="context" :context="context" />
      <div class="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
        <p class="mr-auto text-xs text-muted-foreground">
          Выбрано {{ selectedStoryIds.length }} историй, {{ selectedTaskIds.length }} задач · {{ selectionMinutes }} мин<span v-if="selectionUnestimated"> + {{ selectionUnestimated }} без оценки</span>
        </p>
        <Button size="sm" variant="outline" :disabled="busy || !hasSelection" @click="move(null)">
          В бэклог
        </Button>
        <Button size="sm" :disabled="busy || !hasSelection || !selectedSprintId" @click="move(selectedSprintId)">
          <ArrowRight :size="14" />В выбранный спринт
        </Button>
        <Button v-if="undoToken" size="sm" variant="outline" :disabled="busy" @click="undo">
          <Undo2 :size="14" />Отменить перенос
        </Button>
        <Button size="sm" variant="outline" :disabled="busy || loading || !goal.trim() || !selectedSprintId || context?.remainingMinutes == null || context.remainingMinutes <= 0" @click="propose(context!.capacityMinutes! - context!.reserveMinutes, goal)">
          Предложить план
        </Button>
      </div>
    </div>
    <p v-if="selectedSprint && !goal.trim()" class="text-xs text-muted-foreground">
      Укажите цель спринта, чтобы предложить состав плана.
    </p>
    <p v-if="error" role="alert" class="text-sm text-destructive">
      {{ error }} <button class="underline" @click="load">
        Повторить загрузку
      </button>
    </p>
    <p v-if="notice" role="status" class="text-sm text-muted-foreground">
      {{ notice }}
    </p>
    <details v-if="proposal" open class="rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm">
      <summary class="cursor-pointer font-medium">
        Почему предложены эти элементы
      </summary><p class="mt-2 text-xs text-muted-foreground">
        Подбор по цели, очередности, зависимостям и доступному бюджету. Измените выделение ниже и примените перенос.
      </p><ul class="mt-2 space-y-1 text-xs">
        <li v-for="reason in proposal.reasons" :key="reason.id">
          <strong>{{ titleOf(reason.id) }}</strong> — {{ reason.reason }}
        </li>
      </ul><details v-if="proposal.excluded.length" class="mt-3">
        <summary class="cursor-pointer text-xs text-muted-foreground">
          Не вошли: {{ proposal.excluded.length }}
        </summary><ul class="mt-2 space-y-1 text-xs">
          <li v-for="item in proposal.excluded" :key="item.id">
            {{ titleOf(item.id) }} — {{ item.reason }}
          </li>
        </ul>
      </details>
    </details>
    <p v-if="loading && !context" class="py-8 text-center text-sm text-muted-foreground">
      Загрузка планирования…
    </p>
    <div v-if="context" class="grid items-start gap-4 xl:grid-cols-2">
      <PlanningQueue v-model:task-selection="selectedTaskIds" v-model:story-selection="selectedStoryIds" :project-id="projectId" title="Бэклог" :tasks="backlogTasks" :stories="backlogStories" :busy="busy" :carryover-counts="context.carryoverCounts" @open-task="emit('openTask', $event)" @reorder="ids => reorder(ids, null)" @move-story="moveStory" />
      <PlanningQueue v-if="selectedSprint" v-model:task-selection="selectedTaskIds" v-model:story-selection="selectedStoryIds" :project-id="projectId" :title="selectedSprint.name" :tasks="sprintTasks" :stories="sprintStories" :busy="busy" :carryover-counts="context.carryoverCounts" @open-task="emit('openTask', $event)" @reorder="ids => reorder(ids, selectedSprintId)" @move-story="moveStory" />
      <div v-else class="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Создайте спринт, чтобы собрать план работы.
      </div>
    </div>
    <StoryWorkflowDialog v-model:open="workflowOpen" :project-id="projectId" />
  </section>
</template>
