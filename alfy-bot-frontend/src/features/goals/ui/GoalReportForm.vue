<script setup lang="ts">
import type { GoalReportStatus, QuestionReportItem } from '@/api/reports'
import { computed, onMounted, ref, watch } from 'vue'
import {
  fetchGoalReportStatus,

  submitAnswer,
  submitPhotoAnswer,
} from '@/api/reports'
import { Button } from '@/components/ui/button'
import AnswerInput from './answer-inputs/AnswerInput.vue'

/**
 * Самодостаточная форма заполнения отчёта по одной цели за одну дату.
 * Вход: goalId + date. Выход: `done`, когда не осталось неотвеченных вопросов.
 * Про очередь целей форма ничего не знает (Phase 5).
 *
 * Запись только через существующие POST-эндпоинты `submitAnswer` /
 * `submitPhotoAnswer`. Формат ответа определяют answer-inputs.
 */
const props = defineProps<{
  goalId: number
  date: string
}>()

const emit = defineEmits<{
  (e: 'done'): void
}>()

const status = ref<GoalReportStatus | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const submitting = ref(false)

// Локально пропущенные (can_skip) вопросы за текущую загрузку статуса.
// На бэк не пишутся, лишь убирают вопрос из текущей очереди заполнения.
const skipped = ref<Set<number>>(new Set())

// Неотвеченные и не пропущенные вопросы — то, что осталось заполнить.
const pending = computed<QuestionReportItem[]>(() => {
  if (!status.value)
    return []
  return status.value.questions.filter(q => !q.answered && !skipped.value.has(q.questionId))
})

const currentQuestion = computed<QuestionReportItem | null>(() => pending.value[0] ?? null)

// Прогресс «N из M»: M — всего due-вопросов, N — порядковый номер текущего.
const totalCount = computed(() => status.value?.questions.length ?? 0)
const currentIndex = computed(() => {
  if (!status.value || !currentQuestion.value)
    return totalCount.value
  const idx = status.value.questions.findIndex(
    q => q.questionId === currentQuestion.value!.questionId,
  )
  return idx + 1
})

async function load() {
  loading.value = true
  error.value = null
  skipped.value = new Set()
  try {
    const data = await fetchGoalReportStatus(props.goalId, props.date)
    status.value = data
    maybeFinish()
  }
  catch {
    error.value = 'Не удалось загрузить отчёт'
  }
  finally {
    loading.value = false
  }
}

function maybeFinish() {
  if (!error.value && pending.value.length === 0) {
    emit('done')
  }
}

async function advance(p: Promise<void>) {
  if (submitting.value || !currentQuestion.value)
    return
  submitting.value = true
  error.value = null
  try {
    await p
    // успех: помечаем текущий вопрос как отвеченный локально
    currentQuestion.value.answered = true
    maybeFinish()
  }
  catch {
    error.value = 'Не удалось сохранить ответ. Попробуйте ещё раз.'
    // fail-fast: НЕ продвигаемся
  }
  finally {
    submitting.value = false
  }
}

function onAnswer(answer: string) {
  const q = currentQuestion.value
  if (!q)
    return
  advance(submitAnswer(q.questionId, props.date, answer))
}

function onPhoto(file: File) {
  const q = currentQuestion.value
  if (!q)
    return
  advance(submitPhotoAnswer(q.questionId, props.date, file))
}

function onSkip() {
  const q = currentQuestion.value
  if (!q || submitting.value)
    return
  skipped.value = new Set(skipped.value).add(q.questionId)
  maybeFinish()
}

onMounted(load)
watch(() => [props.goalId, props.date], load)
</script>

<template>
  <div
    v-if="loading"
    class="flex items-center justify-center py-12 text-muted-foreground"
  >
    Загрузка...
  </div>

  <div
    v-else-if="error && !currentQuestion"
    class="flex flex-col items-center gap-3 py-12 text-center"
    data-testid="report-error"
  >
    <p class="text-destructive">
      {{ error }}
    </p>
    <Button variant="outline" @click="load">
      Повторить
    </Button>
  </div>

  <div v-else-if="currentQuestion" class="space-y-6">
    <p class="text-sm text-muted-foreground">
      {{ currentIndex }} из {{ totalCount }}
    </p>

    <h2 class="text-lg font-semibold text-foreground">
      {{ currentQuestion.question }}
    </h2>

    <p
      v-if="error"
      class="text-sm text-destructive"
      data-testid="report-error"
    >
      {{ error }}
    </p>

    <div :class="submitting && 'pointer-events-none opacity-50'">
      <AnswerInput
        :key="currentQuestion.questionId"
        :type="currentQuestion.type"
        @submit="onAnswer"
        @submit-photo="onPhoto"
      />
    </div>

    <div class="flex items-center gap-3">
      <Button
        v-if="currentQuestion.can_skip"
        variant="ghost"
        :disabled="submitting"
        data-testid="report-skip"
        @click="onSkip"
      >
        Пропустить
      </Button>
      <span
        v-if="submitting"
        class="text-sm text-muted-foreground"
        data-testid="report-submitting"
      >
        Сохранение...
      </span>
    </div>
  </div>

  <div
    v-else
    class="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground"
  >
    Все вопросы заполнены
  </div>
</template>
