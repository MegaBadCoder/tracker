<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import type { FillStatusEntry } from '@/api/reports'
import type { QuestionType } from '@/types'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import { Check } from 'lucide-vue-next'
import { CalendarCellTrigger, CalendarRoot } from 'reka-ui'
import { computed, onMounted, ref } from 'vue'
import { fetchFillStatus, submitAnswer, submitPhotoAnswer } from '@/api/reports'
import { buttonVariants } from '@/components/ui/button'
import {
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeader,
  CalendarHeading,
  CalendarNextButton,
  CalendarPrevButton,
} from '@/components/ui/calendar'
import { intlLocale, weekStartsOn } from '@/composables/useLocale'
import { DATE_FULL, formatDate } from '@/features/tasks/lib/formatters'
import { cn } from '@/lib/utils'
import AnswerInput from './answer-inputs/AnswerInput.vue'

/**
 * Календарь бэкфилла ответов по одному вопросу. Маркирует due-дни:
 * заполнено (✓), незаполнено (обводка, кликабельно), не-due/будущее (приглушено).
 * Клик по незаполненному дню → AnswerInput под календарём. Отдельная кнопка
 * «Заполнить за сегодня». Запись только через submitAnswer/submitPhotoAnswer;
 * статус — из общего report_answers (GET /fill-status).
 */
const props = defineProps<{
  questionId: number
  type: QuestionType
}>()

const emit = defineEmits<{
  (e: 'filled'): void
}>()

const status = ref<FillStatusEntry[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const selected = ref<DateValue | undefined>(undefined)
const submitting = ref(false)
const rowError = ref<string | null>(null)

const filledSet = computed(
  () => new Set(status.value.filter(s => s.filled).map(s => s.date)),
)
const unfilledSet = computed(
  () => new Set(status.value.filter(s => !s.filled).map(s => s.date)),
)

const todayValue = computed(() => today(getLocalTimeZone()))
const maxValue = computed(() => todayValue.value)
const minValue = computed(() =>
  status.value.length > 0 ? parseDate(status.value[0]!.date) : undefined,
)

const selectedIso = computed(() => selected.value?.toString() ?? null)
const todayIso = computed(() => todayValue.value.toString())
const todayFillable = computed(() => unfilledSet.value.has(todayIso.value))
const todayFilled = computed(() => filledSet.value.has(todayIso.value))

const todayButtonLabel = computed(() => {
  if (todayFilled.value)
    return 'Сегодня уже заполнено ✓'
  if (!todayFillable.value)
    return 'Сегодня не запланировано'
  return 'Заполнить за сегодня'
})

// Незаполненные due-дни выбираемы; заполненные и не-due — нет.
function isUnavailable(date: DateValue): boolean {
  return !unfilledSet.value.has(date.toString())
}

function cellClass(date: DateValue): string {
  const iso = date.toString()
  if (iso === selectedIso.value)
    return '' // дефолтная data-[selected] подсветка
  if (filledSet.value.has(iso))
    return 'bg-primary/15 text-primary font-medium'
  if (unfilledSet.value.has(iso))
    return 'ring-1 ring-inset ring-primary/50 text-foreground font-medium'
  return 'text-muted-foreground/50'
}

function selectIso(iso: string) {
  if (submitting.value)
    return
  selected.value = parseDate(iso)
  rowError.value = null
}

function onCalendarSelect(value: DateValue | undefined) {
  if (!value || !unfilledSet.value.has(value.toString()))
    return
  selectIso(value.toString())
}

function fillToday() {
  if (todayFillable.value)
    selectIso(todayIso.value)
}

function dayLabel(iso: string): string {
  if (iso === todayIso.value)
    return 'Сегодня'
  const yesterday = todayValue.value.subtract({ days: 1 }).toString()
  if (iso === yesterday)
    return 'Вчера'
  const [y, m, d] = iso.split('-').map(Number)
  return formatDate(new Date(y!, (m! - 1), d!), DATE_FULL)
}

function markFilled(iso: string) {
  const entry = status.value.find(s => s.date === iso)
  if (entry)
    entry.filled = true
}

async function persist(p: Promise<void>, failMsg: string) {
  const iso = selectedIso.value
  if (!iso || submitting.value)
    return
  submitting.value = true
  rowError.value = null
  try {
    await p
    markFilled(iso)
    selected.value = undefined
    emit('filled')
  }
  catch {
    rowError.value = failMsg
  }
  finally {
    submitting.value = false
  }
}

function onAnswer(answer: string) {
  const iso = selectedIso.value
  if (iso)
    persist(submitAnswer(props.questionId, iso, answer), 'Не удалось сохранить ответ. Попробуйте ещё раз.')
}

function onPhoto(file: File) {
  const iso = selectedIso.value
  if (iso)
    persist(submitPhotoAnswer(props.questionId, iso, file), 'Не удалось загрузить фото. Попробуйте ещё раз.')
}

onMounted(async () => {
  try {
    status.value = await fetchFillStatus(props.questionId)
  }
  catch {
    loadError.value = 'Не удалось загрузить статус заполнения'
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-3">
    <h3 class="text-sm font-medium text-foreground">
      Заполнить ответы
    </h3>

    <div v-if="loading" class="text-sm text-muted-foreground">
      Загрузка...
    </div>

    <div v-else-if="loadError" class="text-sm text-destructive">
      {{ loadError }}
    </div>

    <div v-else-if="status.length === 0" class="text-sm text-muted-foreground">
      Нет дней для заполнения
    </div>

    <template v-else>
      <button
        type="button"
        :class="cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full')"
        :disabled="!todayFillable || submitting"
        data-testid="backfill-today"
        @click="fillToday"
      >
        {{ todayButtonLabel }}
      </button>

      <CalendarRoot
        v-slot="{ grid, weekDays }"
        :model-value="(selected as any)"
        :locale="intlLocale"
        :week-starts-on="weekStartsOn"
        weekday-format="short"
        :max-value="maxValue"
        :min-value="minValue"
        :is-date-unavailable="isUnavailable"
        class="rounded-lg border border-border p-3"
        @update:model-value="onCalendarSelect"
      >
        <CalendarHeader>
          <CalendarHeading />
          <div class="flex items-center gap-1">
            <CalendarPrevButton />
            <CalendarNextButton />
          </div>
        </CalendarHeader>

        <div class="flex flex-col gap-y-4 mt-4 sm:flex-row sm:gap-x-4 sm:gap-y-0">
          <CalendarGrid v-for="month in grid" :key="month.value.toString()">
            <CalendarGridHead>
              <CalendarGridRow>
                <CalendarHeadCell v-for="day in weekDays" :key="day">
                  {{ day }}
                </CalendarHeadCell>
              </CalendarGridRow>
            </CalendarGridHead>
            <CalendarGridBody>
              <CalendarGridRow
                v-for="(weekDates, index) in month.rows"
                :key="`weekDate-${index}`"
                class="mt-2 w-full"
              >
                <CalendarCell
                  v-for="weekDate in weekDates"
                  :key="weekDate.toString()"
                  :date="weekDate"
                >
                  <CalendarCellTrigger
                    :day="weekDate"
                    :month="month.value"
                    as="button"
                    :class="cn(
                      buttonVariants({ variant: 'ghost' }),
                      'size-8 p-0 font-normal relative',
                      'data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:hover:bg-primary',
                      'data-[disabled]:text-muted-foreground/40 data-[disabled]:opacity-50',
                      'data-[outside-view]:text-muted-foreground/40',
                      cellClass(weekDate),
                    )"
                  >
                    <span>{{ weekDate.day }}</span>
                    <Check
                      v-if="filledSet.has(weekDate.toString()) && weekDate.toString() !== selectedIso"
                      class="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-2.5 w-2.5"
                    />
                  </CalendarCellTrigger>
                </CalendarCell>
              </CalendarGridRow>
            </CalendarGridBody>
          </CalendarGrid>
        </div>
      </CalendarRoot>

      <div class="flex items-center gap-3 text-xs text-muted-foreground">
        <span class="inline-flex items-center gap-1">
          <span class="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-primary/50" /> незаполнено
        </span>
        <span class="inline-flex items-center gap-1">
          <Check class="h-3 w-3 text-primary" /> заполнено
        </span>
      </div>

      <div
        v-if="selected"
        class="rounded-lg border border-border p-4 space-y-3"
        data-testid="backfill-input-panel"
      >
        <p class="text-sm font-medium text-foreground">
          Ответ за {{ dayLabel(selectedIso!) }}
        </p>
        <p
          v-if="rowError"
          class="text-sm text-destructive"
          data-testid="backfill-error"
        >
          {{ rowError }}
        </p>
        <div
          class="transition-opacity"
          :class="{ 'pointer-events-none opacity-50': submitting }"
        >
          <AnswerInput
            :key="selectedIso!"
            :type="type"
            @submit="onAnswer"
            @submit-photo="onPhoto"
          />
        </div>
        <span v-if="submitting" class="text-sm text-muted-foreground">
          Сохранение...
        </span>
      </div>
    </template>
  </div>
</template>
