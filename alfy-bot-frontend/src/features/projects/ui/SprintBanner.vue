<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Info } from 'lucide-vue-next'
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

const detailsOpen = ref(false)
watch(() => sprint.value?.id, () => { detailsOpen.value = false })

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
    <button type="button" class="inline-flex min-h-9 items-center gap-2 rounded-md text-left font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" :aria-label="`Описание спринта: ${sprint.name}`" @click="detailsOpen = true">
      {{ sprint.name }}
      <Info class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
    <Dialog v-model:open="detailsOpen">
      <DialogContent class="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle class="pr-6">{{ sprint.name }}</DialogTitle>
          <DialogDescription>Описание спринта</DialogDescription>
        </DialogHeader>
        <p class="whitespace-pre-wrap break-words text-sm leading-relaxed">{{ sprint.goal || 'Описание спринта не добавлено.' }}</p>
        <p v-if="deadline" class="text-sm text-muted-foreground">{{ deadline }}</p>
      </DialogContent>
    </Dialog>
    <span v-if="deadline" class="text-muted-foreground">{{ deadline }}</span>
    <span v-if="progress" class="text-muted-foreground">{{ progress.done }} из {{ progress.total }} готово</span>
    <div v-if="canComplete || $slots.default" class="flex flex-wrap items-center gap-2">
      <Button v-if="canComplete" size="sm" variant="outline" @click="$emit('complete')">
        Завершить спринт
      </Button>
      <slot />
    </div>
  </div>
</template>
