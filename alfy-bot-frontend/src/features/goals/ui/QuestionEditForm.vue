<script setup lang="ts">
import type { QuestionWithScheduleItem } from '@/api/goals'
import type { FrequencyType, QuestionType } from '@/types'
import { computed, reactive, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QUESTION_TYPE_OPTIONS } from './steps/question-types'

const props = defineProps<{
  initial: QuestionWithScheduleItem
  submitLabel?: string
  error?: string
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'save', value: QuestionWithScheduleItem): void
  (e: 'cancel'): void
}>()

interface Draft {
  type: QuestionType
  question: string
  targetValue: string
  canSkip: boolean
  scheduleType: FrequencyType
  selectedDays: number[]
  intervalDays: number
}

const draft = reactive<Draft>({
  type: props.initial.type,
  question: props.initial.question ?? '',
  targetValue: props.initial.targetValue ?? '',
  canSkip: props.initial.canSkip ?? false,
  scheduleType: props.initial.scheduleType,
  selectedDays: [...(props.initial.selectedDays ?? [])],
  intervalDays: props.initial.intervalDays ?? 1,
})

const localError = ref<string>('')

// Зеркало бота: Пн-первым; index 0=Вс как в JS getDay()
const WEEKDAYS: { idx: number, label: string }[] = [
  { idx: 1, label: 'Пн' },
  { idx: 2, label: 'Вт' },
  { idx: 3, label: 'Ср' },
  { idx: 4, label: 'Чт' },
  { idx: 5, label: 'Пт' },
  { idx: 6, label: 'Сб' },
  { idx: 0, label: 'Вс' },
]

const INTERVAL_PRESETS = [2, 3, 7, 14]

const submitLabel = computed(() => props.submitLabel ?? 'Сохранить')

function selectType(t: QuestionType) {
  draft.type = t
}

function selectSchedule(s: FrequencyType) {
  draft.scheduleType = s
}

function toggleWeekday(idx: number) {
  const i = draft.selectedDays.indexOf(idx)
  if (i >= 0)
    draft.selectedDays.splice(i, 1)
  else
    draft.selectedDays.push(idx)
}

function isWeekdayActive(idx: number): boolean {
  return draft.selectedDays.includes(idx)
}

function pickIntervalPreset(n: number) {
  draft.intervalDays = n
}

function buildPayload(): QuestionWithScheduleItem {
  const payload: QuestionWithScheduleItem = {
    question: draft.question.trim(),
    type: draft.type,
    canSkip: draft.canSkip,
    scheduleType: draft.scheduleType,
  }
  if (draft.type === 'number') {
    const trimmed = draft.targetValue.trim()
    if (trimmed.length > 0)
      payload.targetValue = trimmed
  }
  if (draft.scheduleType === 'weekly_days')
    payload.selectedDays = [...draft.selectedDays]
  if (draft.scheduleType === 'interval')
    payload.intervalDays = draft.intervalDays
  return payload
}

function onSave() {
  const trimmedQuestion = draft.question.trim()
  if (trimmedQuestion.length === 0) {
    localError.value = 'Введи текст вопроса'
    return
  }
  if (draft.type === 'number') {
    const trimmedTarget = draft.targetValue.trim()
    if (trimmedTarget.length > 0 && Number.isNaN(Number(trimmedTarget))) {
      localError.value = 'Эталонное значение должно быть числом'
      return
    }
  }
  if (draft.scheduleType === 'weekly_days' && draft.selectedDays.length === 0) {
    localError.value = 'Выбери хотя бы один день недели'
    return
  }
  if (draft.scheduleType === 'interval' && (!Number.isInteger(draft.intervalDays) || draft.intervalDays < 1)) {
    localError.value = 'Интервал должен быть не меньше 1'
    return
  }
  localError.value = ''
  emit('save', buildPayload())
}

function onCancel() {
  emit('cancel')
}
</script>

<template>
  <div class="space-y-6">
    <p v-if="error" class="text-sm text-destructive" data-testid="api-error">
      {{ error }}
    </p>

    <!-- 1. Тип вопроса -->
    <div class="space-y-2">
      <h3 class="text-sm font-semibold">
        Тип вопроса
      </h3>
      <div class="flex flex-col gap-2">
        <Button
          v-for="opt in QUESTION_TYPE_OPTIONS"
          :key="opt.type"
          :variant="draft.type === opt.type ? 'default' : 'outline'"
          size="lg"
          class="justify-start"
          :data-testid="`type-${opt.type}`"
          @click="selectType(opt.type)"
        >
          <span class="mr-2">{{ opt.emoji }}</span>
          <span>{{ opt.label }}</span>
        </Button>
      </div>
    </div>

    <!-- 2. Текст вопроса -->
    <div class="space-y-2">
      <h3 class="text-sm font-semibold">
        Текст вопроса
      </h3>
      <Input
        v-model="draft.question"
        placeholder="Например: Сколько страниц прочитал?"
        data-testid="question-text"
      />
    </div>

    <!-- 3. Эталонное значение (только для number) -->
    <div v-if="draft.type === 'number'" class="space-y-2">
      <h3 class="text-sm font-semibold">
        Эталонное значение
      </h3>
      <p class="text-sm text-muted-foreground">
        Это будет линия-ориентир на графике. Можно оставить пустым.
      </p>
      <Input
        v-model="draft.targetValue"
        type="text"
        inputmode="numeric"
        placeholder="Например: 10"
        data-testid="target-value"
      />
    </div>

    <!-- 4. Можно пропустить -->
    <div class="space-y-2">
      <h3 class="text-sm font-semibold">
        Можно ли пропустить этот вопрос?
      </h3>
      <div class="flex gap-2">
        <Button
          :variant="draft.canSkip ? 'default' : 'outline'"
          data-testid="can-skip-yes"
          @click="draft.canSkip = true"
        >
          Да
        </Button>
        <Button
          :variant="!draft.canSkip ? 'default' : 'outline'"
          data-testid="can-skip-no"
          @click="draft.canSkip = false"
        >
          Нет
        </Button>
      </div>
    </div>

    <!-- 5. Частота -->
    <div class="space-y-2">
      <h3 class="text-sm font-semibold">
        Как часто отчитываться?
      </h3>
      <div class="flex flex-col gap-2">
        <Button
          :variant="draft.scheduleType === 'daily' ? 'default' : 'outline'"
          size="lg"
          class="justify-start"
          data-testid="schedule-daily"
          @click="selectSchedule('daily')"
        >
          Каждый день
        </Button>
        <Button
          :variant="draft.scheduleType === 'weekly_days' ? 'default' : 'outline'"
          size="lg"
          class="justify-start"
          data-testid="schedule-weekly_days"
          @click="selectSchedule('weekly_days')"
        >
          Определённые дни недели
        </Button>
        <Button
          :variant="draft.scheduleType === 'interval' ? 'default' : 'outline'"
          size="lg"
          class="justify-start"
          data-testid="schedule-interval"
          @click="selectSchedule('interval')"
        >
          Через N дней
        </Button>
      </div>
    </div>

    <!-- 6. Дни недели (только weekly_days) -->
    <div v-if="draft.scheduleType === 'weekly_days'" class="space-y-2">
      <h3 class="text-sm font-semibold">
        Дни отчёта
      </h3>
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="d in WEEKDAYS"
          :key="d.idx"
          :variant="isWeekdayActive(d.idx) ? 'default' : 'outline'"
          size="sm"
          :data-testid="`weekday-${d.idx}`"
          @click="toggleWeekday(d.idx)"
        >
          {{ d.label }}
        </Button>
      </div>
    </div>

    <!-- 7. Интервал (только interval) -->
    <div v-if="draft.scheduleType === 'interval'" class="space-y-2">
      <h3 class="text-sm font-semibold">
        Через сколько дней
      </h3>
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="n in INTERVAL_PRESETS"
          :key="n"
          :variant="draft.intervalDays === n ? 'default' : 'outline'"
          size="sm"
          :data-testid="`interval-preset-${n}`"
          @click="pickIntervalPreset(n)"
        >
          Через {{ n }}
        </Button>
      </div>
      <Input
        v-model.number="draft.intervalDays"
        type="text"
        inputmode="numeric"
        placeholder="Своё значение"
        class="max-w-[160px]"
        data-testid="interval-custom"
      />
    </div>

    <!-- Локальный inline-error -->
    <p v-if="localError" class="text-sm text-destructive" data-testid="local-error">
      {{ localError }}
    </p>

    <!-- 8. Footer -->
    <div class="flex gap-2">
      <Button
        variant="default"
        :disabled="submitting"
        data-testid="save"
        @click="onSave"
      >
        {{ submitLabel }}
      </Button>
      <Button
        variant="outline"
        data-testid="cancel"
        @click="onCancel"
      >
        Отмена
      </Button>
    </div>
  </div>
</template>
