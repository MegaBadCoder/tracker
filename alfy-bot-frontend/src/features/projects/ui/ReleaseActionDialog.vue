<script setup lang="ts">
import type { Release } from '../model/types'
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
import { defaultReleaseTarget, releaseProgress } from '../lib/release'
import { useReleaseStore } from '../model/release-store'

/**
 * Выпуск запланированного релиза. Показывает, сколько задач выполнено и не
 * выполнено, и (если есть незавершённые) даёт выбрать, куда их перенести:
 * в другой запланированный релиз или снять с релиза. Если незавершённых задач
 * нет, выбор не показывается и отправляется `moveTo: 'none'` — переносить
 * нечего, значение лишь заполняет обязательное поле запроса.
 */
const props = defineProps<{
  /** Открыт ли диалог. */
  open: boolean
  /** Id проекта релиза. */
  projectId: string
  /** Выпускаемый релиз. */
  release: Release
}>()

const emit = defineEmits<{
  /** Диалог закрыт пользователем или после успешного выпуска. */
  'update:open': [value: boolean]
}>()

const NONE = 'none'

const releaseStore = useReleaseStore()
const taskStore = useTaskStore()

const moveTo = ref<'none' | string>(NONE)
const submitting = ref(false)
const errorMessage = ref<string | null>(null)

const targets = computed(() =>
  releaseStore.plannedReleasesOf(props.projectId).filter(r => r.id !== props.release.id),
)
const progress = computed(() => releaseProgress(taskStore.tasks, props.release.id))
const unfinished = computed(() => progress.value.total - progress.value.done)

const targetName = computed(() => {
  const target = targets.value.find(r => r.id === moveTo.value)
  return target ? `„${target.name}“` : 'без релиза'
})
const consequence = computed(() => {
  const word = pluralRu(unfinished.value, ['задача', 'задачи', 'задач'])
  return `${unfinished.value} ${word} → ${targetName.value}`
})

watch(() => props.open, (isOpen) => {
  if (!isOpen)
    return
  moveTo.value = defaultReleaseTarget(releaseStore.plannedReleasesOf(props.projectId), props.release.id)
  errorMessage.value = null
  submitting.value = false
}, { immediate: true })

async function submit() {
  submitting.value = true
  errorMessage.value = null
  try {
    await releaseStore.releaseRelease(props.projectId, props.release.id, unfinished.value === 0 ? NONE : moveTo.value)
    emit('update:open', false)
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Не удалось выпустить релиз')
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
        <DialogTitle>Выпустить „{{ release.name }}“</DialogTitle>
        <DialogDescription data-testid="release-action-summary">
          Выполнено {{ progress.done }}, не выполнено {{ unfinished }}
        </DialogDescription>
      </DialogHeader>

      <fieldset v-if="unfinished > 0" class="grid gap-2">
        <legend class="mb-1 text-sm font-medium">
          Что сделать с незавершёнными задачами
        </legend>
        <label
          v-for="target in targets"
          :key="target.id"
          class="flex cursor-pointer items-center gap-2 text-sm"
        >
          <input v-model="moveTo" type="radio" name="release-action-target" :value="target.id">
          В релиз „{{ target.name }}“
        </label>
        <label class="flex cursor-pointer items-center gap-2 text-sm">
          <input v-model="moveTo" type="radio" name="release-action-target" :value="NONE">
          Снять с релиза
        </label>
        <p class="text-xs text-muted-foreground" data-testid="release-action-consequence">
          {{ consequence }}
        </p>
      </fieldset>

      <p v-if="errorMessage" class="text-sm text-destructive" role="alert" data-testid="release-action-error">
        {{ errorMessage }}
      </p>

      <DialogFooter class="gap-2 sm:gap-0">
        <Button type="button" variant="outline" @click="emit('update:open', false)">
          Отмена
        </Button>
        <Button type="button" :disabled="submitting" @click="submit">
          Выпустить
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
