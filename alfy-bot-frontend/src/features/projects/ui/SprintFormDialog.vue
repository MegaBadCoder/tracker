<script setup lang="ts">
import type { Sprint } from '../model/types'
import { CalendarIcon, X } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { intlLocale, weekStartsOn } from '@/composables/useLocale'
import { toLocalISODate } from '@/features/goals/lib/dates'
import { toCalendarDateValue, toDate } from '@/features/tasks/lib/dateTime'
import { formatDueDate } from '@/features/tasks/lib/formatters'
import { apiErrorMessage } from '../lib/api-error'
import { parseLocalDate, sprintEndFromDuration } from '../lib/sprint'
import { useSprintStore } from '../model/sprint-store'

type Weeks = 1 | 2 | 3 | 4

const props = defineProps<{
  /** Открыт ли диалог. */
  open: boolean
  /** `start` — запуск запланированного спринта (`startSprint`), `edit` — правка полей (`updateSprint`). */
  mode: 'start' | 'edit'
  /** Id проекта спринта. */
  projectId: string
  /** Спринт, с полями которого заполняется форма. */
  sprint: Sprint
}>()

const emit = defineEmits<{
  /** Диалог закрыт пользователем или после успешного сохранения. */
  'update:open': [value: boolean]
}>()

const DURATIONS: Weeks[] = [1, 2, 3, 4]
const DEFAULT_WEEKS: Weeks = 2

const sprintStore = useSprintStore()

const name = ref('')
const goal = ref('')
const weeks = ref<Weeks | 'custom'>(DEFAULT_WEEKS)
const startDate = ref<Date | undefined>()
const endDate = ref<Date | undefined>()
const startOpen = ref(false)
const endOpen = ref(false)
const submitting = ref(false)
const errorMessage = ref<string | null>(null)

const isStart = computed(() => props.mode === 'start')
const title = computed(() => (isStart.value ? 'Начать спринт' : 'Изменить спринт'))
const submitLabel = computed(() => (isStart.value ? 'Начать' : 'Сохранить'))

const startCalendarValue = computed(() => toCalendarDateValue(startDate.value))
const endCalendarValue = computed(() => toCalendarDateValue(endDate.value))

const datesInvalid = computed(() =>
  !!startDate.value && !!endDate.value && startDate.value.getTime() > endDate.value.getTime(),
)
const startDatesMissing = computed(() => isStart.value && (!startDate.value || !endDate.value))
const canSubmit = computed(() =>
  name.value.trim().length > 0 && !datesInvalid.value && !startDatesMissing.value && !submitting.value,
)

function resetForm() {
  name.value = props.sprint.name
  goal.value = props.sprint.goal ?? ''
  errorMessage.value = null
  submitting.value = false

  if (isStart.value) {
    const today = new Date()
    startDate.value = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    weeks.value = DEFAULT_WEEKS
    endDate.value = sprintEndFromDuration(startDate.value, DEFAULT_WEEKS)
    return
  }

  startDate.value = props.sprint.startDate ? parseLocalDate(props.sprint.startDate) : undefined
  endDate.value = props.sprint.endDate ? parseLocalDate(props.sprint.endDate) : undefined
}

watch(() => props.open, (isOpen) => {
  if (isOpen)
    resetForm()
}, { immediate: true })

function selectDuration(value: Weeks) {
  weeks.value = value
  if (startDate.value)
    endDate.value = sprintEndFromDuration(startDate.value, value)
}

function onStartChange(value: unknown) {
  startOpen.value = false
  startDate.value = toDate(value)
  if (isStart.value && weeks.value !== 'custom' && startDate.value)
    endDate.value = sprintEndFromDuration(startDate.value, weeks.value)
}

function onEndChange(value: unknown) {
  endOpen.value = false
  endDate.value = toDate(value)
  if (isStart.value)
    weeks.value = 'custom'
}

function formatDate(date: Date | undefined): string {
  return date ? formatDueDate(date, { includeYear: true }) : 'Не задано'
}

function isoOrNull(date: Date | undefined): string | null {
  return date ? toLocalISODate(date) : null
}

async function saveStart() {
  const newName = name.value.trim()
  if (newName !== props.sprint.name)
    await sprintStore.updateSprint(props.projectId, props.sprint.id, { name: newName })
  await sprintStore.startSprint(props.projectId, props.sprint.id, {
    startDate: toLocalISODate(startDate.value!),
    endDate: toLocalISODate(endDate.value!),
    goal: goal.value.trim() || null,
  })
}

async function saveEdit() {
  const payload: { name?: string, goal?: string | null, startDate?: string | null, endDate?: string | null } = {}
  const newName = name.value.trim()
  const newGoal = goal.value.trim() || null
  const newStart = isoOrNull(startDate.value)
  const newEnd = isoOrNull(endDate.value)

  if (newName !== props.sprint.name)
    payload.name = newName
  if (newGoal !== props.sprint.goal)
    payload.goal = newGoal
  if (newStart !== props.sprint.startDate)
    payload.startDate = newStart
  if (newEnd !== props.sprint.endDate)
    payload.endDate = newEnd

  if (Object.keys(payload).length > 0)
    await sprintStore.updateSprint(props.projectId, props.sprint.id, payload)
}

async function submit() {
  if (!canSubmit.value)
    return
  submitting.value = true
  errorMessage.value = null
  try {
    if (isStart.value)
      await saveStart()
    else
      await saveEdit()
    emit('update:open', false)
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Не удалось сохранить спринт')
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
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription class="sr-only">
          {{ isStart ? 'Задайте срок спринта и запустите его' : 'Измените название, цель и даты спринта' }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid gap-4" @submit.prevent="submit">
        <label class="grid gap-1.5 text-sm font-medium">
          Название
          <Input v-model="name" placeholder="Название спринта" aria-label="Название спринта" />
        </label>

        <label class="grid gap-1.5 text-sm font-medium">
          Цель
          <Textarea v-model="goal" placeholder="Чего хотим достичь" class="min-h-20 text-sm" aria-label="Цель спринта" />
        </label>

        <div v-if="isStart" class="grid gap-1.5">
          <span class="text-sm font-medium">Длительность</span>
          <div class="flex flex-wrap gap-1.5" role="group" aria-label="Длительность спринта">
            <Button
              v-for="value in DURATIONS"
              :key="value"
              type="button"
              size="sm"
              :variant="weeks === value ? 'default' : 'outline'"
              :aria-pressed="weeks === value"
              @click="selectDuration(value)"
            >
              {{ value }} нед.
            </Button>
            <Button v-if="weeks === 'custom'" type="button" size="sm" aria-pressed="true" disabled>
              Свой срок
            </Button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <Popover v-model:open="startOpen">
            <div class="relative rounded-md border border-border">
              <PopoverTrigger as-child>
                <button type="button" class="w-full cursor-pointer px-3 py-2 text-left transition-colors hover:bg-muted/50" aria-label="Дата начала">
                  <span class="mb-1 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                    <CalendarIcon :size="13" />
                    Начало
                  </span>
                  <span class="block truncate text-sm" :class="[!startDate && 'text-muted-foreground/60']">
                    {{ formatDate(startDate) }}
                  </span>
                </button>
              </PopoverTrigger>
              <button
                v-if="!isStart && startDate"
                type="button"
                class="absolute right-2 top-2 cursor-pointer rounded-sm p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Очистить дату начала"
                @click.stop="startDate = undefined"
              >
                <X :size="14" />
              </button>
            </div>
            <PopoverContent class="w-auto p-0">
              <Calendar
                :model-value="startCalendarValue"
                :max-value="endCalendarValue"
                :locale="intlLocale"
                :week-starts-on="weekStartsOn"
                weekday-format="short"
                @update:model-value="onStartChange"
              />
            </PopoverContent>
          </Popover>

          <Popover v-model:open="endOpen">
            <div class="relative rounded-md border border-border">
              <PopoverTrigger as-child>
                <button type="button" class="w-full cursor-pointer px-3 py-2 text-left transition-colors hover:bg-muted/50" aria-label="Дата окончания">
                  <span class="mb-1 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                    <CalendarIcon :size="13" />
                    Конец
                  </span>
                  <span class="block truncate text-sm" :class="[!endDate && 'text-muted-foreground/60']">
                    {{ formatDate(endDate) }}
                  </span>
                </button>
              </PopoverTrigger>
              <button
                v-if="!isStart && endDate"
                type="button"
                class="absolute right-2 top-2 cursor-pointer rounded-sm p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Очистить дату окончания"
                @click.stop="endDate = undefined"
              >
                <X :size="14" />
              </button>
            </div>
            <PopoverContent class="w-auto p-0">
              <Calendar
                :model-value="endCalendarValue"
                :min-value="startCalendarValue"
                :locale="intlLocale"
                :week-starts-on="weekStartsOn"
                weekday-format="short"
                @update:model-value="onEndChange"
              />
            </PopoverContent>
          </Popover>
        </div>

        <p v-if="datesInvalid" class="text-sm text-destructive" role="alert">
          Дата начала позже даты окончания
        </p>
        <p v-if="errorMessage" class="text-sm text-destructive" role="alert" data-testid="sprint-form-error">
          {{ errorMessage }}
        </p>

        <DialogFooter class="gap-2 sm:gap-0">
          <Button type="button" variant="outline" @click="emit('update:open', false)">
            Отмена
          </Button>
          <Button type="submit" :disabled="!canSubmit">
            {{ submitLabel }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
