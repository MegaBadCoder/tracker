<script setup lang="ts">
import type { CompleteSprintPayload, Sprint } from '../model/types'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { pluralRu } from '@/lib/plural'
import { apiErrorMessage } from '../lib/api-error'
import { defaultCompleteTarget, sprintProgress } from '../lib/sprint'
import { useGroupStore } from '../model/group-store'
import { useSprintStore } from '../model/sprint-store'

/**
 * Завершение активного спринта. Показывает, сколько задач выполнено и не
 * выполнено, и (если есть незавершённые) даёт выбрать, куда их перенести:
 * в один из запланированных спринтов или в бэклог. Если незавершённых задач
 * нет, выбор не показывается и отправляется `moveTo: 'backlog'` — переносить
 * нечего, значение лишь заполняет обязательное поле запроса.
 */
const props = defineProps<{
  /** Открыт ли диалог. */
  open: boolean
  /** Id проекта спринта. */
  projectId: string
  /** Завершаемый активный спринт. */
  sprint: Sprint
}>()

const emit = defineEmits<{
  /** Диалог закрыт пользователем или после успешного завершения. */
  'update:open': [value: boolean]
}>()

const BACKLOG = 'backlog'

const sprintStore = useSprintStore()
const taskStore = useTaskStore()
const groups = useGroupStore()
const goalOutcome = ref<'' | 'achieved' | 'partial' | 'missed'>('')
const retrospective = ref('')
const improvement = ref('')
const carryoverReason = ref('')
const taskTargets = ref<Record<string, string>>({})
const storyTargets = ref<Record<string, string>>({})
const unfinishedTasks = computed(() => taskStore.tasks.filter(task => task.sprintId === props.sprint.id && !task.completed))
const unfinishedStories = computed(() => groups.groupsOf(props.projectId).flatMap(epic => epic.children).filter(story => story.sprintId === props.sprint.id && story.status !== 'done'))
const unfinishedStoryIds = computed(() => new Set(unfinishedStories.value.map(story => story.id)))

const moveTo = ref<'backlog' | string>(BACKLOG)
const submitting = ref(false)
const errorMessage = ref<string | null>(null)

const plannedSprints = computed(() => sprintStore.plannedSprintsOf(props.projectId))
const progress = computed(() => sprintProgress(taskStore.tasks, props.sprint.id))
const unfinished = computed(() => progress.value.total - progress.value.done)

const targetName = computed(() => {
  const target = plannedSprints.value.find(s => s.id === moveTo.value)
  return target ? `„${target.name}“` : 'бэклог'
})
const consequence = computed(() => {
  const word = pluralRu(unfinished.value, ['задача', 'задачи', 'задач'])
  return `${unfinished.value} ${word} → ${targetName.value}`
})

watch(() => props.open, (isOpen) => {
  if (!isOpen)
    return
  moveTo.value = defaultCompleteTarget(plannedSprints.value)
  goalOutcome.value = ''
  retrospective.value = ''
  improvement.value = ''
  carryoverReason.value = ''
  taskTargets.value = {}
  storyTargets.value = {}
  errorMessage.value = null
  submitting.value = false
}, { immediate: true })

async function submit() {
  submitting.value = true
  errorMessage.value = null
  try {
    const details: Omit<CompleteSprintPayload, 'moveTo'> = {}
    if (goalOutcome.value)
      details.goalOutcome = goalOutcome.value
    if (retrospective.value.trim())
      details.retrospective = retrospective.value.trim()
    if (improvement.value.trim())
      details.improvement = improvement.value.trim()
    if (carryoverReason.value.trim())
      details.carryoverReason = carryoverReason.value.trim()
    const taskDestinations = Object.entries(taskTargets.value).filter(([id, target]) => typeof target === 'string' && target !== '' && !unfinishedStoryIds.value.has(unfinishedTasks.value.find(task => task.id === id)?.groupId ?? '')).map(([taskId, target]) => ({ taskId, sprintId: target === BACKLOG ? null : target }))
    const storyDestinations = Object.entries(storyTargets.value).filter(([, target]) => typeof target === 'string' && target !== '').map(([storyId, target]) => ({ storyId, sprintId: target === BACKLOG ? null : target }))
    if (taskDestinations.length)
      details.taskDestinations = taskDestinations
    if (storyDestinations.length)
      details.storyDestinations = storyDestinations
    const target = unfinished.value === 0 && unfinishedStories.value.length === 0 ? BACKLOG : moveTo.value
    if (Object.keys(details).length)
      await sprintStore.completeSprint(props.projectId, props.sprint.id, target, details)
    else
      await sprintStore.completeSprint(props.projectId, props.sprint.id, target)
    emit('update:open', false)
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Не удалось завершить спринт')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Завершить „{{ sprint.name }}“</DialogTitle>
        <DialogDescription data-testid="sprint-complete-summary">
          Выполнено {{ progress.done }}, не выполнено {{ unfinished }}
        </DialogDescription>
      </DialogHeader>

      <fieldset v-if="unfinished > 0 || unfinishedStories.length > 0" class="grid gap-2">
        <legend class="mb-1 text-sm font-medium">
          Куда перенести незавершённые задачи
        </legend>
        <label
          v-for="target in plannedSprints"
          :key="target.id"
          class="flex cursor-pointer items-center gap-2 text-sm"
        >
          <input v-model="moveTo" type="radio" name="sprint-complete-target" :value="target.id">
          {{ target.name }}
        </label>
        <label class="flex cursor-pointer items-center gap-2 text-sm">
          <input v-model="moveTo" type="radio" name="sprint-complete-target" :value="BACKLOG">
          Бэклог
        </label>
        <p class="text-xs text-muted-foreground" data-testid="sprint-complete-consequence">
          {{ consequence }}
        </p>
      </fieldset>

      <details v-if="unfinishedTasks.length || unfinishedStories.length" class="rounded-lg border border-border p-3 text-sm">
        <summary class="cursor-pointer">
          Распределить остаток по отдельности
        </summary>
        <p class="mt-2 text-xs text-muted-foreground">
          Незавершённые задачи открытой истории переносятся вместе с ней.
        </p>
        <div class="mt-3 space-y-3">
          <label v-for="story in unfinishedStories" :key="story.id" class="grid gap-1.5 text-xs">История: {{ story.title }}
            <select v-model="storyTargets[story.id]" :aria-label="`Перенести историю ${story.title}`" class="min-h-9 rounded-md border border-input bg-background px-2"><option :value="undefined">По общему правилу</option><option value="backlog">Бэклог</option><option v-for="target in plannedSprints" :key="target.id" :value="target.id">{{ target.name }}</option></select>
          </label>
          <label v-for="task in unfinishedTasks" :key="task.id" class="grid gap-1.5 text-xs">{{ task.title }}
            <select v-model="taskTargets[task.id]" :disabled="!!task.groupId && unfinishedStoryIds.has(task.groupId)" :aria-label="`Перенести задачу ${task.title}`" class="min-h-9 rounded-md border border-input bg-background px-2 disabled:opacity-50"><option :value="undefined">Вместе с историей / по общему правилу</option><option value="backlog">Бэклог</option><option v-for="target in plannedSprints" :key="target.id" :value="target.id">{{ target.name }}</option></select>
          </label>
        </div>
      </details>
      <label class="grid gap-1.5 text-sm">Достигнута ли цель
        <select v-model="goalOutcome" aria-label="Достижение цели спринта" class="min-h-9 rounded-md border border-input bg-background px-2"><option value="">Не оценивать</option><option value="achieved">Достигнута</option><option value="partial">Частично</option><option value="missed">Не достигнута</option></select>
      </label>
      <label class="grid gap-1.5 text-sm">Что получилось<Textarea v-model="retrospective" aria-label="Итоги спринта" class="min-h-16" /></label>
      <label v-if="unfinished || unfinishedStories.length" class="grid gap-1.5 text-sm">Почему переносим<Textarea v-model="carryoverReason" aria-label="Причины переноса" class="min-h-16" /></label>
      <label class="grid gap-1.5 text-sm">Одно изменение на следующий спринт<Textarea v-model="improvement" aria-label="Улучшение следующего спринта" class="min-h-16" /></label>

      <p v-if="errorMessage" class="text-sm text-destructive" role="alert" data-testid="sprint-complete-error">
        {{ errorMessage }}
      </p>

      <DialogFooter class="gap-2 sm:gap-0">
        <Button type="button" variant="outline" @click="emit('update:open', false)">
          Отмена
        </Button>
        <Button type="button" :disabled="submitting" @click="submit">
          Завершить
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
