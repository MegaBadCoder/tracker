<script setup lang="ts">
import type { PlanningContext } from '../model/planning-types'
import { Play } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { getTaskTimerState, toTimerTask, useTimerStore } from '@/features/task-timer'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { fetchPlanning } from '../api/planning-api'
import { apiErrorMessage } from '../lib/api-error'
import { useGroupStore } from '../model/group-store'
import { useSprintStore } from '../model/sprint-store'
import { useStoryWorkflowStore } from '../model/story-workflow-store'
import { useGroupDetail } from '../model/use-group-detail'
import SprintCapacityBar from './SprintCapacityBar.vue'
import StoryStatusPicker from './StoryStatusPicker.vue'

const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{ openTask: [id: string] }>()
const sprints = useSprintStore()
const groups = useGroupStore()
const tasks = useTaskStore()
const timer = useTimerStore()
const workflow = useStoryWorkflowStore()
const detail = useGroupDetail()
const context = ref<PlanningContext | null>(null)
const error = ref('')
let request = 0
const sprint = computed(() => sprints.activeSprintOf(props.projectId))
const stories = computed(() => groups.groupsOf(props.projectId).flatMap(epic => epic.children))
const activeStories = computed(() => stories.value.filter(story => story.sprintId === sprint.value?.id || context.value?.tasks.some(task => task.groupId === story.id && task.sprintId === sprint.value?.id)))
const blockedStories = computed(() => activeStories.value.filter(story => story.blockedReason || story.archived || (story.deferredUntil && context.value?.today && story.deferredUntil > context.value.today) || story.dependencyIds?.some(id => stories.value.find(dependency => dependency.id === id)?.status !== 'done')))
const inProgress = computed(() => activeStories.value.filter(story => workflow.statusesOf(props.projectId).find(status => status.id === story.workflowStatusId)?.category === 'in_progress'))
const next = computed(() => (context.value?.tasks ?? []).filter(task => task.sprintId === sprint.value?.id && !task.completed && !task.blocked).sort((a, b) => a.order - b.order))
watch(() => props.projectId, (id) => {
  workflow.ensure(id)
  groups.ensureGroups(id)
}, { immediate: true })
watch([() => props.projectId, () => sprint.value?.id, () => tasks.tasks, () => groups.trees[props.projectId]], async () => {
  const version = ++request
  context.value = null
  error.value = ''
  if (!sprint.value)
    return
  try {
    const { data } = await fetchPlanning(props.projectId, sprint.value.id)
    if (version === request)
      context.value = data
  }
  catch (err) {
    if (version === request)
      error.value = apiErrorMessage(err, 'Не удалось загрузить фокус спринта')
  }
}, { immediate: true })

function canStart(id: string) {
  const task = tasks.tasks.find(task => task.id === id)
  return task?.isPomodoroTask && task.pomodoroDuration && task.pomodoroCount && task.shortBreak != null && task.longBreak != null && task.longBreakInterval
}

function start(id: string) {
  const task = tasks.tasks.find(task => task.id === id)
  if (!task || !canStart(id))
    return
  if (timer.isActive && timer.activeTaskId !== id) {
    error.value = 'Сначала приостановите текущий таймер.'
    return
  }
  if (getTaskTimerState(id, timer) === 'paused') {
    timer.toggleTimer()
    return
  }
  timer.startTask(toTimerTask(task))
}
</script>

<template>
  <section class="space-y-4" aria-label="Фокус спринта">
    <p v-if="!sprint" class="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      Начните спринт, чтобы выбрать ближайшую работу.
    </p>
    <template v-else>
      <div>
        <p class="text-xs text-muted-foreground">
          {{ sprint.name }} · до {{ sprint.endDate }}
        </p><h2 class="mt-1 text-lg font-semibold">
          {{ sprint.goal || 'Задайте цель спринта в планировании' }}
        </h2><p class="mt-2 text-sm text-muted-foreground">
          Историй в работе: {{ inProgress.length }} · с блокерами: {{ blockedStories.length }}
        </p>
      </div>
      <SprintCapacityBar v-if="context" :context="context" />
      <p v-if="error" role="alert" class="text-sm text-destructive">
        {{ error }}
      </p>
      <div class="grid items-start gap-4 lg:grid-cols-[2fr_1fr]">
        <section class="rounded-xl border border-border">
          <h3 class="border-b border-border p-4 text-sm font-semibold">
            Ближайшие действия
          </h3><ul class="divide-y divide-border/60">
            <li v-for="task in next" :key="task.id" class="flex items-center gap-3 p-3">
              <button class="min-w-0 flex-1 text-left text-sm hover:underline" @click="emit('openTask', task.id)">
                {{ task.title }}
              </button><span class="shrink-0 text-xs text-muted-foreground">{{ task.estimateMinutes === null ? 'Без оценки' : `${task.estimateMinutes} мин` }}</span><Button v-if="canStart(task.id)" size="sm" variant="outline" :disabled="timer.isActive && timer.activeTaskId === task.id" :aria-label="`Начать Pomodoro: ${task.title}`" @click="start(task.id)">
                <Play :size="13" />{{ timer.isActive && timer.activeTaskId === task.id ? 'Идёт' : 'Фокус' }}
              </Button>
            </li>
          </ul><p v-if="!next.length" class="p-6 text-sm text-muted-foreground">
            Нет доступных задач. Проверьте блокеры или состав спринта.
          </p>
        </section>
        <section class="rounded-xl border border-border p-4">
          <h3 class="text-sm font-semibold">
            Что мешает результату
          </h3><p v-if="!blockedStories.length" class="mt-3 text-sm text-muted-foreground">
            У историй нет отмеченных блокеров.
          </p><article v-for="story in blockedStories" :key="story.id" class="mt-4 space-y-2 border-t border-border pt-3">
            <button class="text-left text-sm font-medium hover:underline" @click="detail.open(projectId, story.id)">
              {{ story.title }}
            </button><p v-if="story.blockedReason" class="text-xs text-destructive">
              {{ story.blockedReason }}
            </p><p v-for="dependency in stories.filter(s => story.dependencyIds?.includes(s.id) && s.status !== 'done')" :key="dependency.id" class="text-xs text-muted-foreground">
              Ожидает: {{ dependency.title }}
            </p><StoryStatusPicker :story="story" />
          </article>
        </section>
      </div>
    </template>
  </section>
</template>
