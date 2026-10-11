<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/features/tasks/lib/formatters'
import { useTaskStore } from '@/features/tasks/model/task-store'
import { pluralRu } from '@/lib/plural'
import { daysLeft, sprintProgress } from '../lib/sprint'
import { useSprintStore } from '../model/sprint-store'

/**
 * Полоса активного спринта проекта: название, цель, срок, прогресс.
 * Ничего не рендерит, если у проекта нет активного спринта.
 */
const props = withDefaults(defineProps<{
  /** Id проекта, активный спринт которого показывается. */
  projectId: string
  /** Показывать кнопку «Завершить спринт». */
  canComplete?: boolean
}>(), {
  canComplete: false,
})

defineEmits<{
  /** Пользователь нажал «Завершить спринт». */
  complete: []
}>()

const sprintStore = useSprintStore()
const taskStore = useTaskStore()

const sprint = computed(() => sprintStore.activeSprintOf(props.projectId))

const progress = computed(() => (sprint.value ? sprintProgress(taskStore.tasks, sprint.value.id) : null))

const deadline = computed(() => {
  const endDate = sprint.value?.endDate
  if (!endDate)
    return null

  const left = daysLeft(endDate, new Date())
  const [year, month, day] = endDate.split('-').map(Number)
  const until = `до ${formatDate(new Date(year!, month! - 1, day!), 'd MMM')}`

  if (left === 0)
    return `${until}, последний день`
  if (left < 0) {
    const overdue = Math.abs(left)
    return `${until}, просрочен на ${overdue} ${pluralRu(overdue, ['день', 'дня', 'дней'])}`
  }
  return `${until}, осталось ${left} ${pluralRu(left, ['день', 'дня', 'дней'])}`
})
</script>

<template>
  <div v-if="sprint" class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-2 text-sm">
    <span class="font-medium">{{ sprint.name }}</span>
    <span v-if="sprint.goal" class="text-muted-foreground truncate">{{ sprint.goal }}</span>
    <span v-if="deadline" class="text-muted-foreground">{{ deadline }}</span>
    <span v-if="progress" class="text-muted-foreground">{{ progress.done }} из {{ progress.total }} готово</span>
    <Button v-if="canComplete" size="sm" variant="outline" @click="$emit('complete')">
      Завершить спринт
    </Button>
  </div>
</template>
