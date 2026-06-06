<script setup lang="ts">
import type { GoalReportStatus } from '@/api/reports'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchGoalReportStatus } from '@/api/reports'
import PageContainer from '@/components/PageContainer.vue'
import { Button } from '@/components/ui/button'
import { toLocalISODate } from '@/features/goals/lib/dates'
import GoalReportForm from '@/features/goals/ui/GoalReportForm.vue'
import AppHeader from '../components/AppHeader.vue'

const route = useRoute()
const router = useRouter()

const goalId = Number(route.params.id)

function todayLocalISO(): string {
  return toLocalISODate(new Date())
}

const today = todayLocalISO()

// Дата отчёта берётся из query (?date=YYYY-MM-DD), иначе — сегодня.
const date = computed(() => {
  const q = route.query.date
  return typeof q === 'string' && q.length > 0 ? q : today
})

// После завершения текущей даты предлагаем дозаполнить последнюю незаполненную.
const lastUnfilledDate = ref<string | null>(null)
const showCatchUp = ref(false)

async function onDone() {
  // Узнаём, есть ли ещё незаполненные даты по этой цели.
  let status: GoalReportStatus | null = null
  try {
    status = await fetchGoalReportStatus(goalId, date.value)
  }
  catch {
    status = null
  }

  const lud = status?.lastUnfilledDate ?? null
  if (lud && date.value === today) {
    lastUnfilledDate.value = lud
    showCatchUp.value = true
    return
  }

  router.push({ name: 'goal', params: { id: goalId } })
}

function catchUp() {
  if (!lastUnfilledDate.value)
    return
  showCatchUp.value = false
  // Смена query перезагрузит форму на нужную дату (watch по date).
  router.replace({ query: { date: lastUnfilledDate.value } })
}

function skipCatchUp() {
  showCatchUp.value = false
  router.push({ name: 'goal', params: { id: goalId } })
}
</script>

<template>
  <div>
    <AppHeader title="Отчёт по цели" :show-back="true" />

    <PageContainer class="space-y-6">
      <div
        v-if="showCatchUp"
        class="flex flex-col items-center gap-4 py-12 text-center"
        data-testid="report-catchup"
      >
        <p class="text-foreground">
          Есть незаполненный отчёт за {{ lastUnfilledDate }}. Дозаполнить?
        </p>
        <div class="flex items-center gap-3">
          <Button data-testid="report-catchup-fill" @click="catchUp">
            Дозаполнить
          </Button>
          <Button variant="outline" data-testid="report-catchup-skip" @click="skipCatchUp">
            Готово
          </Button>
        </div>
      </div>

      <GoalReportForm
        v-else
        :key="date"
        :goal-id="goalId"
        :date="date"
        @done="onDone"
      />
    </PageContainer>
  </div>
</template>
