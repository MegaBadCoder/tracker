<script setup lang="ts">
import type { Task } from '../model/types'
import { GitBranch, Plus, X } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
const editing = ref(false)
const saving = ref(false)
const query = ref('')
const draft = ref<string[]>([])
let generation = 0

const canEdit = computed(() => props.editable && !props.task.isOverdue && !!taskLinkPath(props.task.id))
const taskMap = computed(() => new Map(tasks.tasks.map(task => [task.id, task])))
const savedIds = computed(() => graph.edges.filter(edge => edge.taskId === props.task.id && taskMap.value.has(edge.dependencyId)).map(edge => edge.dependencyId))
const selected = computed(() => (editing.value ? draft.value : savedIds.value).map(id => taskMap.value.get(id)).filter((task): task is Task => !!task))
const waiting = computed(() => savedIds.value.filter(id => !taskMap.value.get(id)?.completed).length)
const candidates = computed(() => tasks.tasks.filter(task =>
  task.id !== props.task.id && taskLinkPath(task.id) && !draft.value.includes(task.id)
  && task.title.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()),
))

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

function message(cause: unknown): string {
  const response = (cause as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  if (typeof response === 'string')
    return response
  if (Array.isArray(response))
    return response.join('. ')
  return cause instanceof Error ? cause.message : 'Не удалось сохранить зависимости'
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
      loadError.value = message(cause)
  }
  finally {
    if (request === generation)
      loading.value = false
  }
}

function beginEditing() {
  draft.value = [...savedIds.value]
  query.value = ''
  saveError.value = null
  editing.value = true
}

async function save() {
  if (!canEdit.value || saving.value)
    return
  const request = generation
  const taskId = props.task.id
  saving.value = true
  saveError.value = null
  try {
    await graph.replace(taskId, draft.value.filter(id => taskMap.value.has(id)))
    if (request === generation)
      editing.value = false
  }
  catch (cause) {
    if (request === generation)
      saveError.value = message(cause)
  }
  finally {
    if (request === generation)
      saving.value = false
  }
}

watch(() => props.task.id, () => {
  editing.value = false
  saving.value = false
  saveError.value = null
  draft.value = []
  void load()
}, { immediate: true })
watch(canEdit, (editable) => {
  if (!editable)
    editing.value = false
})
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
        {{ waiting ? `Ожидает: ${waiting}` : 'Предшественники выполнены' }}
      </span>
      <Button v-if="canEdit && !editing && !loading && !loadError" variant="ghost" size="sm" class="ml-auto h-7 text-xs" aria-label="Изменить зависимости" @click="beginEditing">
        Изменить
      </Button>
    </div>
    <p v-if="loading" class="text-xs text-muted-foreground" role="status">
      Загрузка зависимостей…
    </p>
    <div v-else-if="loadError" role="alert" class="space-y-2 text-xs text-destructive">
      <p>Не удалось загрузить зависимости: {{ loadError }}</p>
      <Button variant="outline" size="sm" aria-label="Повторить загрузку зависимостей" @click="load">
        Повторить
      </Button>
    </div>
    <template v-else>
      <ul v-if="selected.length" class="space-y-2">
        <li v-for="predecessor in selected" :key="predecessor.id" class="flex min-w-0 items-center gap-2 rounded-md border border-border/60 px-2.5 py-2">
          <span class="size-2 shrink-0 rounded-full" :class="predecessor.completed ? 'bg-emerald-500' : 'bg-amber-500'" />
          <div class="min-w-0 flex-1">
            <a :href="taskLinkPath(predecessor.id)!" class="block text-sm hover:underline [overflow-wrap:anywhere]">{{ predecessor.title }}</a>
            <p class="text-[11px] text-muted-foreground">
              {{ predecessor.completed ? 'Выполнена' : 'Не выполнена' }}<span v-if="scope(predecessor)"> · {{ scope(predecessor) }}</span>
            </p>
          </div>
          <Button v-if="editing" variant="ghost" size="icon-sm" :disabled="saving" :aria-label="`Убрать предшественника ${predecessor.title}`" @click="draft = draft.filter(id => id !== predecessor.id)">
            <X :size="14" />
          </Button>
        </li>
      </ul>
      <p v-else class="text-xs text-muted-foreground">
        {{ editing ? 'Предшественники не выбраны' : 'Нет предшественников' }}
      </p>
      <div v-if="editing" class="space-y-2">
        <Input v-model="query" :disabled="saving" aria-label="Найти предшественника" placeholder="Найти свою задачу…" class="h-8 text-sm" />
        <ul v-if="candidates.length" class="max-h-40 overflow-y-auto rounded-md border border-border/60">
          <li v-for="candidate in candidates" :key="candidate.id">
            <button type="button" class="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-muted disabled:opacity-50" :disabled="saving" :aria-label="`Добавить предшественника ${candidate.title}`" @click="draft.push(candidate.id)">
              <Plus :size="13" class="shrink-0 text-muted-foreground" />
              <span class="min-w-0 text-xs [overflow-wrap:anywhere]">{{ candidate.title }}<span v-if="scope(candidate)" class="block text-[11px] text-muted-foreground">{{ scope(candidate) }}</span></span>
            </button>
          </li>
        </ul>
        <p v-else class="text-xs text-muted-foreground">
          Подходящих задач нет
        </p>
        <p v-if="saveError" role="alert" class="text-xs text-destructive">
          Не удалось сохранить: {{ saveError }}
        </p>
        <div class="flex flex-wrap gap-2">
          <Button size="sm" :disabled="saving" data-testid="save-dependencies" @click="save">
            {{ saving ? 'Сохранение…' : 'Сохранить зависимости' }}
          </Button>
          <Button size="sm" variant="ghost" :disabled="saving" @click="editing = false">
            Отмена
          </Button>
        </div>
        <p class="text-[11px] text-muted-foreground">
          Ожидание не меняет статус задачи и не мешает завершить её вручную.
        </p>
      </div>
    </template>
  </section>
</template>
