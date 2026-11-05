<script setup lang="ts">
import type { Task } from '../model/types'
import { GitBranch, Plus, X } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { taskKey } from '@/features/projects/lib/task-key'
import { useProjectStore } from '@/features/projects/model/project-store'
import { useSprintStore } from '@/features/projects/model/sprint-store'
import { taskLinkPath } from '../lib/task-link'
import { useTaskDependencyStore } from '../model/task-dependency-store'
import { useTaskStore } from '../model/task-store'

const props = defineProps<{ task: Task, editable: boolean }>()
const graph = useTaskDependencyStore()
const tasks = useTaskStore()
const projects = useProjectStore()
const sprints = useSprintStore()
const loading = ref(false)
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)
interface DependencyAction { kind: 'add' | 'remove', dependencyId: string }
const failedAction = ref<DependencyAction | null>(null)
const pendingIds = ref<string[] | null>(null)
const saving = ref(false)
const query = ref('')
const taskNumberPattern = /^#?\d+$/
const cyrillicPattern = /\p{Script=Cyrillic}/u
let generation = 0

const canEdit = computed(() => props.editable && !props.task.isOverdue && !!taskLinkPath(props.task.id))
const taskMap = computed(() => new Map(tasks.tasks.map(task => [task.id, task])))
const savedIds = computed(() => graph.edges.filter(edge => edge.taskId === props.task.id && taskMap.value.has(edge.dependencyId)).map(edge => edge.dependencyId))
const selected = computed(() => (pendingIds.value ?? savedIds.value).map(id => taskMap.value.get(id)).filter((task): task is Task => !!task))
const waiting = computed(() => savedIds.value.filter(id => !taskMap.value.get(id)?.completed).length)
const candidates = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  if (!search)
    return []
  const numberSearch = taskNumberPattern.test(search)
  return tasks.tasks.filter(task =>
    task.id !== props.task.id && taskLinkPath(task.id) && !savedIds.value.includes(task.id)
    && (task.title.toLocaleLowerCase().includes(search)
      || (numberSearch ? task.number === Number(search.replace('#', '')) : keyFor(task)?.toLocaleLowerCase().includes(search))),
  )
})

function keyFor(task: Task): string | null {
  return taskKey(task.projectId ? projects.projectMap.get(task.projectId) : undefined, task)
    ?? (typeof task.number === 'number' ? `#${task.number}` : null)
}

function scope(task: Task): string {
  const labels: string[] = []
  if (task.projectId !== props.task.projectId) {
    labels.push(task.projectId ? projects.projectMap.get(task.projectId)?.title ?? 'Другой проект' : 'Входящие')
  }
  if (task.sprintId !== props.task.sprintId) {
    const sprint = task.projectId ? sprints.sprintsOf(task.projectId).find(item => item.id === task.sprintId) : undefined
    labels.push(task.sprintId ? sprint?.name ?? 'Другой спринт' : 'Без спринта')
  }
  return labels.join(' · ')
}

function message(cause: unknown, fallback: string): string {
  const response = (cause as { response?: { status?: number, data?: { message?: unknown } } })?.response
  const raw = response?.data?.message
  const detail = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.filter(item => typeof item === 'string').join('. ') : ''
  if (response?.status && response.status >= 400 && response.status < 500 && cyrillicPattern.test(detail))
    return detail
  return fallback
}

function mergeSnapshot(snapshot: Task[], before: Map<string, string>) {
  const fresh = new Map(snapshot.map(task => [task.id, task]))
  const currentIds = new Set(tasks.tasks.map(task => task.id))
  tasks.tasks = tasks.tasks.flatMap((task) => {
    if (before.get(task.id) !== JSON.stringify(task))
      return [task]
    const updated = fresh.get(task.id)
    return updated ? [updated] : []
  })
  tasks.tasks.push(...snapshot.filter(task => !currentIds.has(task.id) && !before.has(task.id)))
}

async function load() {
  const request = ++generation
  loading.value = true
  loadError.value = null
  const before = new Map(tasks.tasks.map(task => [task.id, JSON.stringify(task)]))
  try {
    const [snapshot] = await Promise.all([tasks.fetchTaskSnapshot(), graph.fetchGraph()])
    if (request !== generation)
      return
    mergeSnapshot(snapshot, before)
  }
  catch (cause) {
    if (request === generation)
      loadError.value = message(cause, 'Не удалось загрузить зависимости. Проверьте подключение и повторите попытку.')
  }
  finally {
    if (request === generation)
      loading.value = false
  }
}

async function save(action: DependencyAction) {
  if (!canEdit.value || saving.value || loading.value)
    return
  if (action.kind === 'add' && !taskMap.value.has(action.dependencyId)) {
    saveError.value = 'Задача больше недоступна. Обновите список зависимостей.'
    failedAction.value = null
    return
  }
  const request = generation
  const taskId = props.task.id
  const ids = action.kind === 'add'
    ? [...new Set([...savedIds.value, action.dependencyId])]
    : savedIds.value.filter(id => id !== action.dependencyId)
  saving.value = true
  saveError.value = null
  failedAction.value = null
  pendingIds.value = ids
  try {
    await graph.replace(taskId, ids)
    if (request === generation && action.kind === 'add')
      query.value = ''
  }
  catch (cause) {
    if (request === generation) {
      saveError.value = message(cause, 'Не удалось сохранить зависимости. Проверьте подключение и повторите попытку.')
      failedAction.value = action
    }
  }
  finally {
    if (request === generation) {
      saving.value = false
      pendingIds.value = null
    }
  }
}

watch(() => props.task.id, () => {
  saving.value = false
  saveError.value = null
  failedAction.value = null
  pendingIds.value = null
  query.value = ''
  void load()
}, { immediate: true })
onBeforeUnmount(() => generation++)
</script>

<template>
  <section class="min-w-0 space-y-3" aria-label="Зависимости задачи">
    <div class="flex flex-wrap items-center gap-2">
      <GitBranch :size="15" class="text-muted-foreground" />
      <h3 class="text-sm font-medium">
        Зависит от
      </h3>
      <span v-if="!loading && !loadError && savedIds.length" class="text-xs text-muted-foreground" role="status">
        {{ waiting ? `Незавершённых зависимостей: ${waiting}` : 'Все зависимости выполнены' }}
      </span>
    </div>
    <p v-if="loading" class="text-xs text-muted-foreground" role="status">
      Загрузка зависимостей…
    </p>
    <div v-else-if="loadError" role="alert" class="space-y-2 text-xs text-destructive">
      <p>{{ loadError }}</p>
      <Button variant="outline" size="sm" aria-label="Повторить загрузку зависимостей" @click="load">
        Повторить
      </Button>
    </div>
    <template v-else>
      <ul v-if="selected.length" class="space-y-2">
        <li v-for="predecessor in selected" :key="predecessor.id" class="flex min-w-0 items-center gap-2 rounded-md border border-border/60 px-2.5 py-2">
          <span class="size-2 shrink-0 rounded-full" :class="predecessor.completed ? 'bg-emerald-500' : 'bg-amber-500'" />
          <div class="min-w-0 flex-1">
            <a :href="taskLinkPath(predecessor.id)!" class="block text-sm hover:underline [overflow-wrap:anywhere]"><span v-if="keyFor(predecessor)" class="mr-1.5 font-mono text-[11px] text-muted-foreground">{{ keyFor(predecessor) }}</span>{{ predecessor.title }}</a>
            <p class="text-[11px] text-muted-foreground">
              {{ predecessor.completed ? 'Выполнена' : 'Не выполнена' }}<span v-if="scope(predecessor)"> · {{ scope(predecessor) }}</span>
            </p>
          </div>
          <Button v-if="canEdit" variant="ghost" size="icon-sm" :disabled="saving" :aria-label="`Убрать предшественника ${predecessor.title}`" @click="save({ kind: 'remove', dependencyId: predecessor.id })">
            <X :size="14" />
          </Button>
        </li>
      </ul>
      <p v-else class="text-xs text-muted-foreground">
        Зависимости не добавлены
      </p>
      <div v-if="canEdit" class="space-y-2">
        <Input v-model="query" :disabled="saving" aria-label="Поиск задач по названию или номеру" placeholder="Поиск задач по названию или номеру" class="h-8 text-sm" />
        <ul v-if="candidates.length" class="max-h-40 overflow-y-auto rounded-md border border-border/60">
          <li v-for="candidate in candidates" :key="candidate.id">
            <button type="button" class="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-muted disabled:opacity-50" :disabled="saving" :aria-label="`Добавить предшественника ${candidate.title}`" @click="save({ kind: 'add', dependencyId: candidate.id })">
              <Plus :size="13" class="shrink-0 text-muted-foreground" />
              <span class="min-w-0 text-xs [overflow-wrap:anywhere]"><span v-if="keyFor(candidate)" class="mr-1.5 font-mono text-muted-foreground">{{ keyFor(candidate) }}</span>{{ candidate.title }}<span v-if="scope(candidate)" class="block text-[11px] text-muted-foreground">{{ scope(candidate) }}</span></span>
            </button>
          </li>
        </ul>
        <p v-else-if="query.trim()" class="text-xs text-muted-foreground">
          Подходящих задач нет
        </p>
        <p v-if="saveError" role="alert" class="text-xs text-destructive">
          {{ saveError }}
        </p>
        <Button v-if="failedAction" size="sm" variant="outline" :disabled="saving" aria-label="Повторить сохранение" @click="save(failedAction)">
          Повторить сохранение
        </Button>
        <p v-if="saving" role="status" class="text-xs text-muted-foreground">
          Сохранение…
        </p>
        <p class="text-[11px] text-muted-foreground">
          Ожидание не меняет статус задачи и не мешает завершить её вручную.
        </p>
      </div>
    </template>
  </section>
</template>
