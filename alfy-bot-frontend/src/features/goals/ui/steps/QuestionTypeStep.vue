<script setup lang="ts">
import type { QuestionWithScheduleItem } from '@/api/goals'
import type { FlowState } from '@/features/goals/model/use-goal-create-flow'
import type { QuestionType } from '@/types'
import { ArrowLeft, Check, Pencil, Trash2 } from 'lucide-vue-next'
import { ref } from 'vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { WEEKDAY_LABELS } from './goal-create-options'
import { QUESTION_TYPE_OPTIONS } from './question-types'

defineProps<{ state: FlowState }>()
const emit = defineEmits<{
  (e: 'selectQuestionType', t: QuestionType): void
  (e: 'finishQuestions'): void
  (e: 'back'): void
  (e: 'editPendingQuestion', idx: number): void
  (e: 'removePendingQuestion', idx: number): void
}>()

const deleteIdx = ref<number | null>(null)
// Снимок idx, захваченный при клике trash-иконки. Используется в onConfirmDelete,
// потому что reka-ui AlertDialog emit'ит `update:open(false)` ДО `@click` action-кнопки,
// что обнуляет deleteIdx до запуска confirm-хендлера.
let pendingDeleteIdx: number | null = null

function typeLabel(t: QuestionType): string {
  return QUESTION_TYPE_OPTIONS.find(o => o.type === t)?.label ?? t
}

function scheduleSummary(q: QuestionWithScheduleItem): string {
  if (q.scheduleType === 'daily')
    return 'Каждый день'
  if (q.scheduleType === 'weekly_days') {
    const days = (q.selectedDays ?? [])
      .slice()
      .sort((a, b) => {
        // отсортировать с Пн в начале (1..6), Вс в конце (0)
        const norm = (d: number) => (d === 0 ? 7 : d)
        return norm(a) - norm(b)
      })
      .map(d => WEEKDAY_LABELS[d] ?? String(d))
      .join(', ')
    return `По дням: ${days}`
  }
  if (q.scheduleType === 'interval')
    return `Раз в ${q.intervalDays ?? '?'} дней`
  return ''
}

function openDeleteDialog(idx: number) {
  pendingDeleteIdx = idx
  deleteIdx.value = idx
}

function onConfirmDelete() {
  if (pendingDeleteIdx !== null) {
    emit('removePendingQuestion', pendingDeleteIdx)
    pendingDeleteIdx = null
    deleteIdx.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <section v-if="state.questionsToAdd.length > 0" class="space-y-2">
      <h3 class="text-sm font-semibold text-foreground">
        Добавленные вопросы
      </h3>
      <div class="space-y-2">
        <div
          v-for="(q, idx) in state.questionsToAdd"
          :key="idx"
          class="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2"
          :data-testid="`pending-question-${idx}`"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-foreground truncate">
              {{ q.question }}
            </p>
            <div class="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span class="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5">
                {{ typeLabel(q.type) }}
              </span>
              <span>{{ scheduleSummary(q) }}</span>
            </div>
          </div>
          <button
            type="button"
            class="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent active:bg-accent text-muted-foreground hover:text-foreground"
            :aria-label="`Редактировать вопрос ${idx + 1}`"
            :data-testid="`edit-pending-${idx}`"
            @click="emit('editPendingQuestion', idx)"
          >
            <Pencil class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-destructive/10 active:bg-destructive/10 text-muted-foreground hover:text-destructive"
            :aria-label="`Удалить вопрос ${idx + 1}`"
            :data-testid="`delete-pending-${idx}`"
            @click="openDeleteDialog(idx)"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>

    <h2 class="text-lg font-semibold">
      Выбери тип вопроса:
    </h2>

    <div class="flex flex-col gap-2">
      <Button
        v-for="opt in QUESTION_TYPE_OPTIONS"
        :key="opt.type"
        variant="outline"
        size="lg"
        class="justify-start"
        @click="emit('selectQuestionType', opt.type)"
      >
        {{ opt.label }}
      </Button>
    </div>

    <div class="flex gap-2 flex-wrap">
      <Button
        v-if="state.questionsToAdd.length > 0"
        variant="default"
        @click="emit('finishQuestions')"
      >
        <Check class="size-4" />
        Готово, сохранить
      </Button>
      <Button variant="outline" @click="emit('back')">
        <ArrowLeft class="size-4" />
        Назад
      </Button>
    </div>

    <AlertDialog
      :open="deleteIdx !== null"
      @update:open="(o: boolean) => { if (!o) deleteIdx = null }"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить вопрос?</AlertDialogTitle>
          <AlertDialogDescription>
            <template v-if="deleteIdx !== null">
              Вопрос «{{ state.questionsToAdd[deleteIdx]?.question }}» будет удалён из списка.
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-white hover:bg-destructive/90"
            @click="onConfirmDelete"
          >
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
