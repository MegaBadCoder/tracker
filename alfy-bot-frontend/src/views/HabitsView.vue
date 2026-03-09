<script setup lang="ts">
import { ref, computed, watch, inject } from 'vue'
import { RouterLink } from 'vue-router'
import { Check, X, Minus, ChevronRight } from 'lucide-vue-next'
import AppHeader from '../components/AppHeader.vue'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchHabits } from '../api/habits'
import type { HabitWithHistory } from '../types'

type Days = 7 | 14 | 30

const openSidebar = inject<() => void>('openSidebar')

const habits = ref<HabitWithHistory[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const days = ref<Days>(7)

function dayLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const labels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
  return labels[date.getDay()]
}

function dayNumber(dateStr: string): string {
  return new Date(dateStr).getDate().toString()
}

async function load() {
  loading.value = true
  error.value = null
  try {
    habits.value = await fetchHabits(days.value)
  }
  catch {
    error.value = 'Не удалось загрузить привычки'
    habits.value = []
  }
  finally {
    loading.value = false
  }
}

watch(days, load, { immediate: true })

const periodDates = computed(() => {
  const result: { date: string }[] = []
  const now = new Date()
  for (let i = 0; i < days.value; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    result.push({ date: d.toISOString().slice(0, 10) })
  }
  return result
})

function historyByPeriod(habit: HabitWithHistory) {
  const map = new Map(habit.history.map(h => [h.date.slice(0, 10), h]))
  return periodDates.value.map(d => map.get(d.date) ?? { date: d.date, status: 'not_due' as const })
}

const today = new Date().toISOString().slice(0, 10)

function isToday(dateStr: string): boolean {
  return dateStr.slice(0, 10) === today
}
</script>

<template>
  <AppHeader title="Привычки" :on-menu-click="openSidebar" />

  <main class="max-w-6xl mx-auto px-4 py-6">
    <Tabs
      :model-value="String(days)"
      class="mb-4"
      @update:model-value="(v: string | number) => days = Number(v) as Days"
    >
      <TabsList>
        <TabsTrigger value="7">7 дней</TabsTrigger>
        <TabsTrigger value="14">14 дней</TabsTrigger>
        <TabsTrigger value="30">30 дней</TabsTrigger>
      </TabsList>
    </Tabs>

    <!-- legend -->
    <div class="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
      <span class="flex items-center gap-1">
        <span class="w-5 h-5 rounded flex items-center justify-center bg-green-500/15 text-green-600">
          <Check class="w-3 h-3" />
        </span>
        Выполнено
      </span>
      <span class="flex items-center gap-1">
        <span class="w-5 h-5 rounded flex items-center justify-center bg-destructive/15 text-destructive">
          <X class="w-3 h-3" />
        </span>
        Пропущено
      </span>
      <span class="flex items-center gap-1">
        <span class="w-5 h-5 rounded flex items-center justify-center bg-muted text-muted-foreground">
          <Minus class="w-3 h-3" />
        </span>
        Нет отчёта
      </span>
    </div>

    <div v-if="loading" class="py-20 text-center text-muted-foreground">
      <p class="text-lg">Загрузка...</p>
    </div>
    <div v-else-if="error" class="py-20 text-center text-destructive">
      <p class="text-lg">{{ error }}</p>
    </div>
    <div v-else-if="!habits.length" class="py-20 text-center text-muted-foreground">
      <p class="text-lg">Нет привычек</p>
    </div>

    <!-- table -->
    <div v-else class="rounded-lg border border-border bg-card overflow-x-auto">
      <table class="w-full">
        <!-- header: day labels -->
        <thead>
          <tr class="border-b border-border">
            <th class="text-left text-xs font-medium text-muted-foreground px-3 py-2 sticky left-0 bg-card z-10 min-w-[140px]">
              Привычка
            </th>
            <th
              v-for="entry in periodDates"
              :key="entry.date"
              class="text-center px-1 py-2 min-w-[36px]"
              :class="isToday(entry.date) ? 'bg-primary/10' : ''"
            >
              <div class="text-[10px] leading-tight" :class="isToday(entry.date) ? 'text-primary font-semibold' : 'text-muted-foreground'">{{ dayLabel(entry.date) }}</div>
              <div class="text-[10px] leading-tight" :class="isToday(entry.date) ? 'text-primary font-semibold' : 'text-muted-foreground'">{{ dayNumber(entry.date) }}</div>
            </th>
            <th class="w-8" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="habit in habits"
            :key="habit.id"
            class="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
          >
            <!-- habit name -->
            <td class="px-3 py-2.5 sticky left-0 bg-card z-10">
              <RouterLink
                :to="{ name: 'questionReport', params: { id: habit.id } }"
                class="text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                {{ habit.question }}
              </RouterLink>
            </td>
            <!-- status cells -->
            <td
              v-for="entry in historyByPeriod(habit)"
              :key="entry.date"
              class="text-center px-1 py-2.5"
              :class="isToday(entry.date) ? 'bg-primary/10' : ''"
            >
              <span
                v-if="entry.status === 'filled'"
                class="inline-flex items-center justify-center w-7 h-7 rounded bg-green-500/15 text-green-600"
              >
                <Check class="w-3.5 h-3.5" />
              </span>
              <span
                v-else-if="entry.status === 'not_filled'"
                class="inline-flex items-center justify-center w-7 h-7 rounded bg-destructive/15 text-destructive"
              >
                <X class="w-3.5 h-3.5" />
              </span>
              <span
                v-else
                class="inline-flex items-center justify-center w-7 h-7 rounded bg-muted text-muted-foreground"
              >
                <Minus class="w-3.5 h-3.5" />
              </span>
            </td>
            <!-- arrow -->
            <td class="px-2 py-2.5">
              <RouterLink
                :to="{ name: 'questionReport', params: { id: habit.id } }"
                class="text-muted-foreground hover:text-foreground"
              >
                <ChevronRight class="w-4 h-4" />
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>
