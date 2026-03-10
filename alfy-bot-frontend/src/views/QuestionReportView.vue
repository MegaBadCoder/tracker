<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Pencil } from 'lucide-vue-next'
import AppHeader from '../components/AppHeader.vue'
import QuestionVisual from '../components/reports/visuals/QuestionVisual.vue'
import ScheduleEditor from '../components/ScheduleEditor.vue'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { fetchQuestion, updateQuestion } from '../api/goals'
import { fetchQuestionAnalytics } from '../api/reports'
import { analyticsToDataPoints, type DataPoint } from '../utils/reportAnswer'
import type { Question } from '../types'
import PageContainer from '@/components/PageContainer.vue'

const route = useRoute()
const router = useRouter()

const questionId = Number(route.params.id)

const question = ref<Question | null>(null)
const dataPoints = ref<DataPoint[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const habitUpdating = ref(false)

const editingTitle = ref(false)
const titleDraft = ref('')
const titleSaving = ref(false)
const titleInput = ref<InstanceType<typeof Input> | null>(null)

function startEditingTitle() {
  if (!question.value) return
  titleDraft.value = question.value.question
  editingTitle.value = true
  nextTick(() => {
    const el = titleInput.value?.$el?.querySelector('input') ?? titleInput.value?.$el
    el?.focus()
  })
}

function cancelEditingTitle() {
  editingTitle.value = false
}

async function saveTitle() {
  if (!question.value || titleSaving.value) return
  const trimmed = titleDraft.value.trim()
  if (!trimmed || trimmed === question.value.question) {
    editingTitle.value = false
    return
  }
  titleSaving.value = true
  try {
    const updated = await updateQuestion(question.value.id, { question: trimmed })
    question.value.question = updated.question
    editingTitle.value = false
  } finally {
    titleSaving.value = false
  }
}

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
    <AppHeader :title="question.question" :show-back="true">
      <template #title>
        <Input
          v-if="editingTitle"
          ref="titleInput"
          v-model="titleDraft"
          class="h-8 text-base font-semibold"
          :disabled="titleSaving"
          @keydown.enter="saveTitle"
          @keydown.escape="cancelEditingTitle"
          @blur="saveTitle"
        />
        <span
          v-else
          class="font-semibold text-base truncate cursor-pointer inline-flex items-center gap-1.5 group"
          @click="startEditingTitle"
        >
          {{ question.question }}
          <Pencil class="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </span>
      </template>
    </AppHeader>

    <PageContainer class="space-y-6">
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
    </PageContainer>
  </div>
</template>
