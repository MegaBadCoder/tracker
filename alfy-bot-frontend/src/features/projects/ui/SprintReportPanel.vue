<script setup lang="ts">
import type { SprintReport } from '../model/planning-types'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { fetchSprintReport } from '../api/planning-api'
import { apiErrorMessage } from '../lib/api-error'
import { useSprintStore } from '../model/sprint-store'

const props = defineProps<{ projectId: string }>()
const sprints = useSprintStore()
const selectedId = ref('')
const report = ref<SprintReport | null>(null)
const loading = ref(false)
const error = ref('')
let request = 0
const closed = computed(() => sprints.sprintsOf(props.projectId).filter(s => s.status === 'closed').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')))
const outcomeLabels: Record<string, string> = { achieved: 'Цель достигнута', partial: 'Цель достигнута частично', missed: 'Цель не достигнута' }
const eventLabels: Record<string, string> = { added: 'Добавлена', removed: 'Исключена', completed: 'Выполнена', reopened: 'Открыта снова', deleted: 'Удалена', updated: 'Изменена', moved_in: 'Добавлена', moved_out: 'Перенесена', story_added: 'История добавлена', story_removed: 'История исключена', story_status: 'Статус истории изменён', estimate_changed: 'Оценка изменена' }
watch([() => props.projectId, closed], () => {
  if (!closed.value.some(s => s.id === selectedId.value))
    selectedId.value = closed.value[0]?.id ?? ''
}, { immediate: true })

async function load() {
  const current = ++request
  report.value = null
  error.value = ''
  if (!selectedId.value)
    return
  loading.value = true
  try {
    const { data } = await fetchSprintReport(props.projectId, selectedId.value)
    if (current === request)
      report.value = data
  }
  catch (err) {
    if (current === request)
      error.value = apiErrorMessage(err, 'Не удалось загрузить итоги')
  }
  finally {
    if (current === request)
      loading.value = false
  }
}
watch([() => props.projectId, selectedId], load, { immediate: true })
</script>

<template>
  <section class="space-y-5" aria-label="Итоги спринтов">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg font-semibold">
        История спринтов
      </h2><select v-if="closed.length" v-model="selectedId" aria-label="Завершённый спринт" class="min-h-9 max-w-full rounded-md border border-input bg-background px-3 text-sm">
        <option v-for="sprint in closed" :key="sprint.id" :value="sprint.id">
          {{ sprint.name }}
        </option>
      </select>
    </div>
    <p v-if="!closed.length" class="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      После завершения спринта здесь появятся его план, результат и выводы.
    </p>
    <p v-if="loading" class="text-sm text-muted-foreground">
      Загрузка итогов…
    </p>
    <p v-if="error" role="alert" class="text-sm text-destructive">
      {{ error }} <Button variant="ghost" size="sm" @click="load">
        Повторить
      </Button>
    </p>
    <template v-if="report">
      <div class="rounded-xl border border-border p-4">
        <p class="text-sm text-muted-foreground">
          {{ report.sprint.startDate }} — {{ report.sprint.endDate }}
        </p><h3 class="mt-1 text-lg font-semibold">
          {{ report.sprint.name }}
        </h3><p class="mt-2 text-sm">
          {{ report.sprint.goal || 'Цель не была задана' }}
        </p><p v-if="report.retrospective.goalOutcome" class="mt-2 text-sm font-medium">
          {{ outcomeLabels[report.retrospective.goalOutcome] ?? report.retrospective.goalOutcome }}
        </p>
      </div>
      <p v-if="!report.historyComplete" role="status" class="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        История этого спринта неполная: он начался до включения учёта. Исходный план и процент выполнения нельзя восстановить достоверно.
      </p>
      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div v-for="item in [{ label: 'На старте', value: report.summary.planned }, { label: 'Добавлено', value: report.summary.added }, { label: 'Исключено', value: report.summary.removed }, { label: 'Выполнено', value: report.summary.completed }, { label: 'Перенесено', value: report.summary.carried }]" :key="item.label" class="rounded-lg border border-border p-3">
          <dt class="text-xs text-muted-foreground">
            {{ item.label }}
          </dt><dd class="mt-1 text-xl font-semibold tabular-nums">
            {{ report.historyComplete ? item.value : '—' }}
          </dd>
        </div>
      </dl>
      <div class="grid gap-4 md:grid-cols-2">
        <section v-for="snapshot in [{ title: 'План на старте', data: report.initial }, { title: 'Состав на завершении', data: report.final }]" :key="snapshot.title" class="rounded-xl border border-border p-4">
          <h4 class="text-sm font-semibold">
            {{ snapshot.title }}
          </h4><p v-if="!snapshot.data" class="mt-2 text-sm text-muted-foreground">
            Снимок не сохранён
          </p><ul v-else class="mt-3 space-y-2 text-sm">
            <li v-for="task in snapshot.data.tasks" :key="task.id" class="flex gap-2">
              <span aria-hidden="true">{{ task.completed ? '✓' : '·' }}</span><span class="min-w-0 flex-1">{{ task.title }}</span><span class="shrink-0 text-xs text-muted-foreground">{{ task.estimateMinutes === null ? 'Без оценки' : `${task.estimateMinutes} мин` }}</span>
            </li>
          </ul>
        </section>
      </div>
      <div class="grid gap-4 md:grid-cols-3">
        <section v-for="note in [{ title: 'Что получилось', text: report.retrospective.retrospective }, { title: 'Причины переноса', text: report.retrospective.carryoverReason }, { title: 'Изменение на следующий спринт', text: report.retrospective.improvement }]" :key="note.title" class="rounded-xl border border-border p-4">
          <h4 class="text-sm font-semibold">
            {{ note.title }}
          </h4><p class="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {{ note.text || 'Не записано' }}
          </p>
        </section>
      </div>
      <details class="rounded-xl border border-border p-4">
        <summary class="cursor-pointer text-sm font-medium">
          Изменения состава · {{ report.events.length }}
        </summary><ol class="mt-3 space-y-2">
          <li v-for="event in report.events" :key="event.id" class="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <time class="text-muted-foreground">{{ new Date(event.occurredAt).toLocaleString('ru-RU') }}</time><span>{{ eventLabels[event.kind] ?? event.kind }} · {{ event.title }}</span>
          </li>
        </ol>
      </details>
    </template>
  </section>
</template>
