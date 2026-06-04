<script setup lang="ts">
import type { ReportQueueItem } from '@/api/reports'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchReportQueue } from '@/api/reports'
import PageContainer from '@/components/PageContainer.vue'
import { Button } from '@/components/ui/button'
import { toLocalISODate } from '@/features/goals/lib/dates'
import GoalReportForm from '@/features/goals/ui/GoalReportForm.vue'
import AppHeader from '../components/AppHeader.vue'

/**
 * Оркестрирует заполнение отчётов за сегодня по всем целям пользователя.
 * Очередь приходит с бэка (`report-queue`), форма по каждой цели —
 * самодостаточный `GoalReportForm`. Эта страница знает только про очередь:
 * текущий индекс и переход `next` по `done`. `:key` по goalId форсит
 * ремоунт формы при смене цели, иначе она не перезагрузит status.
 */
const router = useRouter()

function todayLocalISO(): string {
  return toLocalISODate(new Date())
}

const date = todayLocalISO()

const queue = ref<ReportQueueItem[]>([])
const index = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)

const current = computed<ReportQueueItem | null>(() => queue.value[index.value] ?? null)
const finished = computed(() => !loading.value && !error.value && index.value >= queue.value.length)

async function load() {
  loading.value = true
  error.value = null
  try {
    queue.value = await fetchReportQueue(date)
    index.value = 0
  }
  catch {
    error.value = 'Не удалось загрузить очередь отчётов'
  }
  finally {
    loading.value = false
  }
}

function next() {
  index.value += 1
}

function goToGoals() {
  router.push({ name: 'home' })
}

onMounted(load)
</script>

<template>
  <div>
    <AppHeader title="Отчёты за сегодня" :show-back="true" />

    <PageContainer class="space-y-6">
      <div
        v-if="loading"
        class="flex items-center justify-center py-12 text-muted-foreground"
      >
        Загрузка...
      </div>

      <div
        v-else-if="error"
        class="flex flex-col items-center gap-3 py-12 text-center"
        data-testid="report-flow-error"
      >
        <p class="text-destructive">
          {{ error }}
        </p>
        <div class="flex items-center gap-3">
          <Button variant="outline" @click="load">
            Повторить
          </Button>
          <Button variant="ghost" @click="goToGoals">
            К целям
          </Button>
        </div>
      </div>

      <div
        v-else-if="!queue.length"
        class="flex flex-col items-center gap-4 py-12 text-center"
        data-testid="report-flow-empty"
      >
        <p class="text-foreground">
          Все отчёты на сегодня заполнены 🎉
        </p>
        <Button @click="goToGoals">
          К целям
        </Button>
      </div>

      <div
        v-else-if="finished"
        class="flex flex-col items-center gap-4 py-12 text-center"
        data-testid="report-flow-done"
      >
        <p class="text-foreground">
          Все отчёты заполнены 🎉
        </p>
        <Button @click="goToGoals">
          К целям
        </Button>
      </div>

      <div v-else-if="current" class="space-y-6">
        <div class="space-y-1">
          <p class="text-sm text-muted-foreground" data-testid="report-flow-progress">
            Цель {{ index + 1 }} из {{ queue.length }}
          </p>
          <h1 class="text-lg font-semibold text-foreground">
            {{ current.goalName }}
          </h1>
        </div>

        <GoalReportForm
          :key="current.goalId"
          :goal-id="current.goalId"
          :date="date"
          @done="next"
        />
      </div>
    </PageContainer>
  </div>
</template>
