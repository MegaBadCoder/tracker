<script setup lang="ts">
import type { QuestionWithScheduleItem } from '../api/goals'
import type { Goal, Question } from '../types'
import { Pencil, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageContainer from '@/components/PageContainer.vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import QuestionEditForm from '@/features/goals/ui/QuestionEditForm.vue'
import {
  deleteQuestion,
  fetchGoalById,
  updateQuestion,
  updateQuestionSchedule,
} from '../api/goals'
import AppHeader from '../components/AppHeader.vue'
import GoalStatusBadge from '../components/GoalStatusBadge.vue'
import SummaryCard from '../components/SummaryCard.vue'
import { daysLeft, formatDate } from '../utils/date'
import { goalAccent } from '../utils/goalColor'

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)

function goToQuestion(q: { id: number }) {
  return router.push({ name: 'questionReport', params: { id: q.id } })
}

const goal = ref<Goal | null>(null)
const loading = ref(true)

const editingQuestion = ref<Question | null>(null)
const deletingQuestion = ref<Question | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)

async function reloadGoal() {
  goal.value = await fetchGoalById(id)
}

onMounted(async () => {
  try {
    await reloadGoal()
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

function questionToFormValue(q: Question): QuestionWithScheduleItem {
  return {
    question: q.question,
    type: q.type,
    canSkip: q.can_skip,
    scheduleType: q.schedule.frequency_type,
    selectedDays: q.schedule.days_of_week ?? undefined,
    intervalDays: q.schedule.interval_days ?? undefined,
    targetValue: q.target_value ?? undefined,
  }
}

async function onSaveEdit(v: QuestionWithScheduleItem) {
  const q = editingQuestion.value
  if (!q)
    return
  saving.value = true
  saveError.value = null
  try {
    const qChanged
      = q.question !== v.question
        || q.type !== v.type
        || q.can_skip !== v.canSkip
        || (q.target_value ?? undefined) !== v.targetValue
    if (qChanged) {
      await updateQuestion(q.id, {
        question: v.question,
        type: v.type,
        can_skip: v.canSkip,
        target_value: v.type === 'number' ? (v.targetValue ?? null) : null,
      })
    }
    const sChanged
      = q.schedule.frequency_type !== v.scheduleType
        || JSON.stringify(q.schedule.days_of_week ?? null) !== JSON.stringify(v.selectedDays ?? null)
        || (q.schedule.interval_days ?? null) !== (v.intervalDays ?? null)
    if (sChanged) {
      await updateQuestionSchedule(q.id, {
        frequency_type: v.scheduleType,
        days_of_week: v.scheduleType === 'weekly_days' ? v.selectedDays : undefined,
        interval_days: v.scheduleType === 'interval' ? v.intervalDays : undefined,
      })
    }
    await reloadGoal()
    editingQuestion.value = null
  }
  catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'Не удалось сохранить'
  }
  finally {
    saving.value = false
  }
}

async function onConfirmDelete() {
  const q = deletingQuestion.value
  if (!q)
    return
  saving.value = true
  try {
    await deleteQuestion(q.id)
    await reloadGoal()
    deletingQuestion.value = null
  }
  catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'Не удалось удалить'
  }
  finally {
    saving.value = false
  }
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
          <h2 class="text-base font-semibold text-foreground">
            Вопросы цели
          </h2>
        </div>
        <div class="space-y-2">
          <div
            v-for="q in goal.questions.filter(q => q.is_active).sort((a, b) => a.order_index - b.order_index)"
            :key="q.id"
            class="w-full flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 transition-all duration-150 hover:bg-accent hover:border-accent hover:shadow-sm"
          >
            <div
              class="w-1 h-8 rounded-full shrink-0"
              :style="{ backgroundColor: accent }"
            />
            <button
              type="button"
              class="flex-1 min-w-0 text-left flex items-center gap-3 active:scale-[0.98] transition-transform"
              @click="goToQuestion(q)"
            >
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-foreground truncate">
                  {{ q.question }}
                </p>
                <p class="text-xs text-muted-foreground mt-0.5">
                  {{ questionTypeLabel[q.type] ?? q.type }}
                </p>
              </div>
              <span v-if="q.can_skip" class="text-xs text-muted-foreground shrink-0">можно пропустить</span>
              <span class="text-xs text-muted-foreground shrink-0">→</span>
            </button>
            <button
              type="button"
              class="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-background active:bg-background text-muted-foreground hover:text-foreground"
              :aria-label="`Редактировать вопрос: ${q.question}`"
              :data-testid="`edit-question-${q.id}`"
              @click.stop="editingQuestion = q"
            >
              <Pencil class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-destructive/10 active:bg-destructive/10 text-muted-foreground hover:text-destructive"
              :aria-label="`Удалить вопрос: ${q.question}`"
              :data-testid="`delete-question-${q.id}`"
              @click.stop="deletingQuestion = q"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </PageContainer>

    <Sheet
      :open="editingQuestion !== null"
      @update:open="(o: boolean) => { if (!o) { editingQuestion = null; saveError = null } }"
    >
      <SheetContent class="overflow-y-auto p-6">
        <SheetHeader class="px-0">
          <SheetTitle>Редактировать вопрос</SheetTitle>
        </SheetHeader>
        <QuestionEditForm
          v-if="editingQuestion"
          :initial="questionToFormValue(editingQuestion)"
          :error="saveError ?? undefined"
          :submitting="saving"
          @save="onSaveEdit"
          @cancel="editingQuestion = null; saveError = null"
        />
      </SheetContent>
    </Sheet>

    <AlertDialog
      :open="deletingQuestion !== null"
      @update:open="(o: boolean) => { if (!o) deletingQuestion = null }"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить вопрос?</AlertDialogTitle>
          <AlertDialogDescription>
            Вопрос «{{ deletingQuestion?.question }}» будет деактивирован.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-white hover:bg-destructive/90"
            @click="onConfirmDelete"
          >
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
