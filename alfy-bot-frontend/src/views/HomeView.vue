<script setup lang="ts">
import type { Goal, GoalStatus } from '../types'
import type { ReportQueueItem } from '@/api/reports'
import { inject, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { fetchReportQueue } from '@/api/reports'
import PageContainer from '@/components/PageContainer.vue'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toLocalISODate } from '@/features/goals/lib/dates'
import { fetchGoals } from '../api/goals'
import AppHeader from '../components/AppHeader.vue'
import GoalCard from '../components/GoalCard.vue'

type Filter = 'all' | GoalStatus

const router = useRouter()
const goals = ref<Goal[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const openSidebar = inject<() => void>('openSidebar')
const filter = ref<Filter>('all')

// Очередь отчётов за сегодня — второстепенная фича: её фейл НЕ должен ломать
// список целей. При ошибке просто не показываем кнопку (reportQueue=[]).
const reportQueue = ref<ReportQueueItem[]>([])

async function loadReportQueue() {
  try {
    reportQueue.value = await fetchReportQueue(toLocalISODate(new Date()))
  }
  catch {
    reportQueue.value = []
  }
}

async function load() {
  loading.value = true
  error.value = null
  try {
    goals.value = await fetchGoals(filter.value === 'all' ? undefined : filter.value)
  }
  catch {
    error.value = 'Не удалось загрузить цели'
    goals.value = []
  }
  finally {
    loading.value = false
  }
}

watch(filter, load, { immediate: true })
onMounted(loadReportQueue)
</script>

<template>
  <AppHeader title="Мои цели" :on-menu-click="openSidebar" />

  <PageContainer>
    <!-- filters + create -->
    <div class="mb-6 flex flex-row items-center justify-between gap-2">
      <Tabs
        :model-value="filter"
        @update:model-value="(v: string | number) => filter = v as Filter"
      >
        <TabsList>
          <TabsTrigger value="all">
            Все
          </TabsTrigger>
          <TabsTrigger value="active">
            Активные
          </TabsTrigger>
          <TabsTrigger value="completed">
            Завершённые
          </TabsTrigger>
          <TabsTrigger value="archived">
            Архив
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div class="flex flex-shrink-0 items-center gap-2">
        <Button
          v-if="reportQueue.length"
          variant="secondary"
          data-testid="fill-reports-today"
          @click="router.push({ name: 'goalsReportToday' })"
        >
          <span class="sm:hidden">Отчёты ({{ reportQueue.length }})</span>
          <span class="hidden sm:inline">Заполнить отчёты за сегодня ({{ reportQueue.length }})</span>
        </Button>

        <Button @click="router.push({ name: 'goal-create' })">
          <span class="sm:hidden">+</span>
          <span class="hidden sm:inline">+ Создать цель</span>
        </Button>
      </div>
    </div>

    <!-- grid -->
    <div v-if="loading" class="py-20 text-center text-muted-foreground">
      <p class="text-lg">Загрузка...</p>
    </div>
    <div v-else-if="error" class="py-20 text-center text-destructive">
      <p class="text-lg">{{ error }}</p>
    </div>
    <div v-else-if="goals.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <GoalCard v-for="goal in goals" :key="goal.id" :goal="goal" />
    </div>
    <div v-else class="py-20 text-center text-muted-foreground">
      <p class="text-lg">Нет целей в этой категории</p>
    </div>
  </PageContainer>
</template>
