<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import QuestionVisual from '../components/reports/visuals/QuestionVisual.vue'
import ScheduleEditor from '../components/ScheduleEditor.vue'
import { Switch } from '@/components/ui/switch'
import { fetchQuestion, updateQuestion } from '../api/goals'
import { fetchQuestionAnalytics } from '../api/reports'
import { analyticsToDataPoints, type DataPoint } from '../utils/reportAnswer'
import type { Question } from '../types'

const route = useRoute()
const router = useRouter()

const questionId = Number(route.params.id)

const question = ref<Question | null>(null)
const dataPoints = ref<DataPoint[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const habitUpdating = ref(false)

async function toggleHabit(value: boolean) {
  if (!question.value || habitUpdating.value) return
  habitUpdating.value = true
  try {
    const updated = await updateQuestion(question.value.id, { is_habit: value })
    question.value.is_habit = updated.is_habit
  } finally {
    habitUpdating.value = false
  }
}

onMounted(async () => {
  try {
    const [q, entries] = await Promise.all([
      fetchQuestion(questionId),
      fetchQuestionAnalytics(questionId),
    ])
    question.value = q
    dataPoints.value = analyticsToDataPoints(entries)
  } catch (e: any) {
    if (e?.response?.status === 404) {
      router.replace('/not-found')
      return
    }
    error.value = 'Не удалось загрузить данные'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-if="loading" class="min-h-screen flex items-center justify-center text-muted-foreground">
    Загрузка...
  </div>

  <div v-else-if="error" class="min-h-screen flex items-center justify-center">
    <div class="text-center space-y-2">
      <p class="text-destructive">{{ error }}</p>
      <button class="text-sm text-primary hover:underline" @click="router.back()">Назад</button>
    </div>
  </div>

  <div v-else-if="question">
    <AppHeader :title="question.question" :show-back="true" />

    <main class="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <QuestionVisual
        v-if="dataPoints.length"
        :question="question"
        :data-points="dataPoints"
        :accent="'#8b5cf6'"
      />
      <div v-else class="text-sm text-muted-foreground py-8">
        Пока нет данных
      </div>

      <ScheduleEditor
        v-if="question.schedule"
        :question-id="question.id"
        :schedule="question.schedule"
        @updated="(s) => { question!.schedule = s }"
      />

      <div class="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div class="space-y-0.5">
          <p class="text-sm font-medium">Привычка</p>
          <p class="text-xs text-muted-foreground">Отслеживать как привычку на отдельной странице</p>
        </div>
        <Switch
          :checked="question.is_habit"
          :disabled="habitUpdating"
          @update:checked="toggleHabit"
        />
      </div>
    </main>
  </div>
</template>
