<script setup lang="ts">
import type { QuestionType } from '@/types'
import { onMounted, ref } from 'vue'
import { fetchUnfilledDates, submitAnswer, submitPhotoAnswer } from '@/api/reports'
import { DATE_FULL, formatDate } from '@/features/tasks/lib/formatters'
import AnswerInput from './answer-inputs/AnswerInput.vue'

const props = defineProps<{
  questionId: number
  type: QuestionType
}>()

const emit = defineEmits<{
  (e: 'filled'): void
}>()

const MAX_DATES = 90

const dates = ref<string[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const expanded = ref<string | null>(null)
const submitting = ref(false)
const rowError = ref<string | null>(null)

function dayLabel(dateStr: string): string {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  if (dateStr === fmt(today))
    return 'Сегодня'
  if (dateStr === fmt(yesterday))
    return 'Вчера'

  // new Date('YYYY-MM-DD') парсится как UTC-полночь → используем локальный конструктор
  const parts = dateStr.split('-').map(Number)
  const y = parts[0] ?? 2000
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  return formatDate(new Date(y, m - 1, d), DATE_FULL)
}

function toggleExpand(date: string) {
  if (submitting.value)
    return
  expanded.value = expanded.value === date ? null : date
  rowError.value = null
}

async function onAnswer(answer: string) {
  const date = expanded.value
  if (!date || submitting.value)
    return
  submitting.value = true
  rowError.value = null
  try {
    await submitAnswer(props.questionId, date, answer)
    dates.value = dates.value.filter(d => d !== date)
    expanded.value = null
    emit('filled')
  }
  catch {
    rowError.value = 'Не удалось сохранить ответ. Попробуйте ещё раз.'
  }
  finally {
    submitting.value = false
  }
}

async function onPhoto(file: File) {
  const date = expanded.value
  if (!date || submitting.value)
    return
  submitting.value = true
  rowError.value = null
  try {
    await submitPhotoAnswer(props.questionId, date, file)
    dates.value = dates.value.filter(d => d !== date)
    expanded.value = null
    emit('filled')
  }
  catch {
    rowError.value = 'Не удалось загрузить фото. Попробуйте ещё раз.'
  }
  finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    dates.value = await fetchUnfilledDates(props.questionId)
  }
  catch {
    loadError.value = 'Не удалось загрузить незаполненные дни'
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-2">
    <div
      v-if="loading"
      class="text-sm text-muted-foreground"
    >
      Загрузка...
    </div>

    <div
      v-else-if="loadError"
      class="text-sm text-destructive"
    >
      {{ loadError }}
    </div>

    <template v-else-if="dates.length > 0">
      <h3 class="text-sm font-medium text-foreground">
        Незаполненные дни ({{ dates.length }})
      </h3>

      <div class="space-y-1">
        <div
          v-for="date in dates"
          :key="date"
          class="rounded-lg border border-border"
        >
          <button
            type="button"
            class="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors rounded-lg"
            data-testid="backfill-date-row"
            :disabled="submitting && expanded !== date"
            @click="toggleExpand(date)"
          >
            {{ dayLabel(date) }}
          </button>

          <div
            v-if="expanded === date"
            class="px-4 pb-4 space-y-2"
          >
            <p
              v-if="rowError"
              class="text-sm text-destructive"
              data-testid="backfill-row-error"
            >
              {{ rowError }}
            </p>
            <div
              class="transition-opacity"
              :class="{ 'pointer-events-none opacity-50': submitting }"
            >
              <AnswerInput
                :key="date"
                :type="type"
                @submit="onAnswer"
                @submit-photo="onPhoto"
              />
            </div>
            <span
              v-if="submitting"
              class="text-sm text-muted-foreground"
            >
              Сохранение...
            </span>
          </div>
        </div>
      </div>

      <p
        v-if="dates.length >= MAX_DATES"
        class="text-xs text-muted-foreground"
      >
        показаны последние {{ MAX_DATES }}
      </p>
    </template>

    <p
      v-else
      class="text-sm text-muted-foreground"
    >
      Все дни заполнены ✓
    </p>
  </div>
</template>
