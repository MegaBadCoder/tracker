<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import GoalStatusBadge from '../components/GoalStatusBadge.vue'
import SummaryCard from '../components/SummaryCard.vue'
import { fetchGoalById } from '../api/goals'
import type { Goal } from '../types'
import { goalAccent } from '../utils/goalColor'
import { daysLeft, formatDate } from '../utils/date'
import PageContainer from '@/components/PageContainer.vue'

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)

const goToQuestion = (q: { id: number }) =>
  router.push({ name: 'questionReport', params: { id: q.id } })

const goal = ref<Goal | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    goal.value = await fetchGoalById(id)
  }
  catch {
    router.replace('/not-found')
  }
  finally {
    loading.value = false
  }
})

const accent = computed(() => goal.value ? goalAccent(goal.value.id) : '#3b82f6')
const daysLeftVal = computed(() => goal.value ? daysLeft(goal.value.goal_end) : 0)

const questionTypeLabel: Record<string, string> = {
  number: 'Число',
  text: 'Текст',
  rating: 'Рейтинг 1–5',
  emoji_rating: 'Эмодзи',
  yes_no: 'Да / Нет',
  time_spent: 'Время',
}
</script>

<template>
  <div v-if="loading" class="min-h-screen flex items-center justify-center text-muted-foreground">
    Загрузка...
  </div>

  <div v-else-if="goal">
    <AppHeader :title="goal.goal_name" :show-back="true">
      <template #right>
        <GoalStatusBadge :status="goal.status" />
      </template>
    </AppHeader>

    <PageContainer class="space-y-8">
      <!-- summary -->
      <section>
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <SummaryCard label="Начало" :value="formatDate(goal.goal_start)" />
          <SummaryCard label="Конец" :value="formatDate(goal.goal_end)" />
          <SummaryCard
            label="Дней до конца"
            :value="goal.status === 'completed' ? '—' : daysLeftVal > 0 ? daysLeftVal : 'Истёк'"
            :sub="goal.status === 'completed' ? 'Цель завершена' : undefined"
            :accent="goal.status === 'active' && daysLeftVal > 0"
          />
        </div>
      </section>

      <!-- questions -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-semibold text-foreground">Вопросы цели</h2>
        </div>
        <div class="space-y-2">
          <button
            v-for="q in goal.questions.filter(q => q.is_active).sort((a, b) => a.order_index - b.order_index)"
            :key="q.id"
            class="w-full flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 text-left transition-all duration-150 hover:bg-accent hover:border-accent hover:shadow-sm active:scale-[0.98] active:bg-accent"
            @click="goToQuestion(q)"
          >
            <div
              class="w-1 h-8 rounded-full shrink-0"
              :style="{ backgroundColor: accent }"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-foreground truncate">{{ q.question }}</p>
              <p class="text-xs text-muted-foreground mt-0.5">{{ questionTypeLabel[q.type] ?? q.type }}</p>
            </div>
            <span v-if="q.can_skip" class="text-xs text-muted-foreground shrink-0">можно пропустить</span>
            <span class="text-xs text-muted-foreground shrink-0">→</span>
          </button>
        </div>
      </section>
    </PageContainer>
  </div>
</template>
