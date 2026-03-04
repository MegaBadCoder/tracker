<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import QuestionVisual from '../components/reports/visuals/QuestionVisual.vue'
import ScheduleEditor from '../components/ScheduleEditor.vue'
import { fetchQuestionById } from '../api/goals'
import { fetchQuestionAnalytics } from '../api/reports'
import { analyticsToDataPoints, type DataPoint } from '../utils/reportAnswer'
import { goalAccent } from '../utils/goalColor'
import type { Question } from '../types'

const route = useRoute()
const router = useRouter()

const goalId = Number(route.params.id)
const questionId = Number(route.params.questionId)

const accent = computed(() => goalAccent(goalId))

const question = ref<Question | null>(null)
const dataPoints = ref<DataPoint[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const [q, entries] = await Promise.all([
      fetchQuestionById(questionId),
      fetchQuestionAnalytics(questionId),
    ])
    question.value = q
    dataPoints.value = analyticsToDataPoints(entries)
  } catch {
    router.replace('/not-found')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-if="loading" class="min-h-screen flex items-center justify-center text-muted-foreground">
    Загрузка...
  </div>

  <div v-else-if="question">
    <AppHeader :title="question.question" :show-back="true" />

    <main class="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <QuestionVisual
        v-if="dataPoints.length"
        :question="question"
        :data-points="dataPoints"
        :accent="accent"
      />
      <div v-else class="text-sm text-muted-foreground py-8">
        Пока нет данных
      </div>

      <ScheduleEditor
        :question-id="question.id"
        :schedule="question.schedule"
        @updated="(s) => { question!.schedule = s }"
      />
    </main>
  </div>
</template>
