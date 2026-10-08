<script setup lang="ts">
import type { Sprint } from '../model/types'
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
import { useTaskStore } from '@/features/tasks/model/task-store'
import { pluralRu } from '@/lib/plural'
import { apiErrorMessage } from '../lib/api-error'
import { defaultCompleteTarget, sprintProgress } from '../lib/sprint'
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
  errorMessage.value = null
  submitting.value = false
}, { immediate: true })

async function submit() {
  submitting.value = true
  errorMessage.value = null
  try {
    await sprintStore.completeSprint(props.projectId, props.sprint.id, unfinished.value === 0 ? BACKLOG : moveTo.value)
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
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Завершить „{{ sprint.name }}“</DialogTitle>
        <DialogDescription data-testid="sprint-complete-summary">
          Выполнено {{ progress.done }}, не выполнено {{ unfinished }}
        </DialogDescription>
      </DialogHeader>

      <fieldset v-if="unfinished > 0" class="grid gap-2">
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
