<script setup lang="ts">
import type { Release, UpdateReleasePayload } from '../model/types'
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
import { parseLocalDate } from '../lib/sprint'
import { useReleaseStore } from '../model/release-store'

/**
 * Правка запланированного релиза: название, описание, даты начала и выпуска.
 * Отправляются только изменённые поля через `updateRelease`; отказ сервера
 * показывается в диалоге, и диалог остаётся открытым.
 */
const props = defineProps<{
  /** Открыт ли диалог. */
  open: boolean
  /** Id проекта релиза. */
  projectId: string
  /** Релиз, с полями которого заполняется форма. */
  release: Release
}>()

const emit = defineEmits<{
  /** Диалог закрыт пользователем или после успешного сохранения. */
  'update:open': [value: boolean]
}>()

const releaseStore = useReleaseStore()

const name = ref('')
const description = ref('')
const startDate = ref<Date | undefined>()
const releaseDate = ref<Date | undefined>()
const startOpen = ref(false)
const releaseOpen = ref(false)
const submitting = ref(false)
const errorMessage = ref<string | null>(null)

const startCalendarValue = computed(() => toCalendarDateValue(startDate.value))
const releaseCalendarValue = computed(() => toCalendarDateValue(releaseDate.value))

const datesInvalid = computed(() =>
  !!startDate.value && !!releaseDate.value && startDate.value.getTime() > releaseDate.value.getTime(),
)
const canSubmit = computed(() => name.value.trim().length > 0 && !datesInvalid.value && !submitting.value)

function resetForm() {
  name.value = props.release.name
  description.value = props.release.description ?? ''
  startDate.value = props.release.startDate ? parseLocalDate(props.release.startDate) : undefined
  releaseDate.value = props.release.releaseDate ? parseLocalDate(props.release.releaseDate) : undefined
  errorMessage.value = null
  submitting.value = false
}

watch(() => props.open, (isOpen) => {
  if (isOpen)
    resetForm()
}, { immediate: true })

function onStartChange(value: unknown) {
  startOpen.value = false
  startDate.value = toDate(value)
}

function onReleaseChange(value: unknown) {
  releaseOpen.value = false
  releaseDate.value = toDate(value)
}

function formatDate(date: Date | undefined): string {
  return date ? formatDueDate(date, { includeYear: true }) : 'Не задано'
}

function isoOrNull(date: Date | undefined): string | null {
  return date ? toLocalISODate(date) : null
}

function changedFields(): UpdateReleasePayload {
  const payload: UpdateReleasePayload = {}
  const newName = name.value.trim()
  const newDescription = description.value.trim() || null
  const newStart = isoOrNull(startDate.value)
  const newRelease = isoOrNull(releaseDate.value)

  if (newName !== props.release.name)
    payload.name = newName
  if (newDescription !== props.release.description)
    payload.description = newDescription
  if (newStart !== props.release.startDate)
    payload.startDate = newStart
  if (newRelease !== props.release.releaseDate)
    payload.releaseDate = newRelease

  return payload
}

async function submit() {
  if (!canSubmit.value)
    return
  submitting.value = true
  errorMessage.value = null
  try {
    const payload = changedFields()
    if (Object.keys(payload).length > 0)
      await releaseStore.updateRelease(props.projectId, props.release.id, payload)
    emit('update:open', false)
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Не удалось сохранить релиз')
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
        <DialogTitle>Изменить релиз</DialogTitle>
        <DialogDescription class="sr-only">
          Измените название, описание и даты релиза
        </DialogDescription>
      </DialogHeader>

      <form class="grid gap-4" @submit.prevent="submit">
        <label class="grid gap-1.5 text-sm font-medium">
          Название
          <Input v-model="name" placeholder="Название релиза" aria-label="Название релиза" />
        </label>

        <label class="grid gap-1.5 text-sm font-medium">
          Описание
          <Textarea v-model="description" placeholder="Что войдёт в релиз" class="min-h-20 text-sm" aria-label="Описание релиза" />
        </label>

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
                v-if="startDate"
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
                :max-value="releaseCalendarValue"
                :locale="intlLocale"
                :week-starts-on="weekStartsOn"
                weekday-format="short"
                @update:model-value="onStartChange"
              />
            </PopoverContent>
          </Popover>

          <Popover v-model:open="releaseOpen">
            <div class="relative rounded-md border border-border">
              <PopoverTrigger as-child>
                <button type="button" class="w-full cursor-pointer px-3 py-2 text-left transition-colors hover:bg-muted/50" aria-label="Дата выпуска">
                  <span class="mb-1 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                    <CalendarIcon :size="13" />
                    Выпуск
                  </span>
                  <span class="block truncate text-sm" :class="[!releaseDate && 'text-muted-foreground/60']">
                    {{ formatDate(releaseDate) }}
                  </span>
                </button>
              </PopoverTrigger>
              <button
                v-if="releaseDate"
                type="button"
                class="absolute right-2 top-2 cursor-pointer rounded-sm p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Очистить дату выпуска"
                @click.stop="releaseDate = undefined"
              >
                <X :size="14" />
              </button>
            </div>
            <PopoverContent class="w-auto p-0">
              <Calendar
                :model-value="releaseCalendarValue"
                :min-value="startCalendarValue"
                :locale="intlLocale"
                :week-starts-on="weekStartsOn"
                weekday-format="short"
                @update:model-value="onReleaseChange"
              />
            </PopoverContent>
          </Popover>
        </div>

        <p v-if="datesInvalid" class="text-sm text-destructive" role="alert">
          Дата начала позже даты выпуска
        </p>
        <p v-if="errorMessage" class="text-sm text-destructive" role="alert" data-testid="release-form-error">
          {{ errorMessage }}
        </p>

        <DialogFooter class="gap-2 sm:gap-0">
          <Button type="button" variant="outline" @click="emit('update:open', false)">
            Отмена
          </Button>
          <Button type="submit" :disabled="!canSubmit">
            Сохранить
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
