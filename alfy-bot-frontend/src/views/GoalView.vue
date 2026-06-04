<script setup lang="ts">
import type { QuestionWithScheduleItem } from '../api/goals'
import type { GoalReportStatus } from '../api/reports'
import type { Goal, Question } from '../types'
import { Archive, Check, MoreVertical, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-vue-next'
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
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { toLocalISODate } from '@/features/goals/lib/dates'
import { newQuestionDraft } from '@/features/goals/lib/new-question'
import QuestionEditForm from '@/features/goals/ui/QuestionEditForm.vue'
import {
  addGoalQuestions,
  deleteQuestion,
  fetchGoalById,
  fetchQuestionAnswerCount,
  updateGoal,
  updateQuestion,
  updateQuestionSchedule,
} from '../api/goals'
import { fetchGoalReportStatus } from '../api/reports'
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

function goToReport() {
  return router.push({ name: 'goalReport', params: { id } })
}

const goal = ref<Goal | null>(null)
const loading = ref(true)

const editingQuestion = ref<Question | null>(null)
const addingQuestion = ref(false)
const addError = ref<string | null>(null)
const deletingQuestion = ref<Question | null>(null)
// Снимок Question, захваченный при клике trash-иконки. Используется в onConfirmDelete,
// т.к. reka-ui AlertDialog emit'ит `update:open(false)` ДО `@click` action-кнопки,
// что обнуляет deletingQuestion до запуска confirm-хендлера.
let pendingDeletion: Question | null = null
const saving = ref(false)
const saveError = ref<string | null>(null)

// Type-change warning state
const pendingTypeChange = ref<{ value: QuestionWithScheduleItem, count: number } | null>(null)
let pendingTypeChangeSnapshot: { value: QuestionWithScheduleItem, count: number } | null = null

// Goal-level actions (archive / delete / restore)
type GoalAction = 'archive' | 'delete' | 'restore'
const goalActionPending = ref<GoalAction | null>(null)
let pendingGoalAction: GoalAction | null = null

async function reloadGoal() {
  goal.value = await fetchGoalById(id)
}

// Статус сегодняшнего отчёта — чтобы не предлагать повторно заполнять уже сданный.
const reportStatus = ref<GoalReportStatus | null>(null)

async function loadReportStatus() {
  if (goal.value?.status !== 'active') {
    reportStatus.value = null
    return
  }
  try {
    reportStatus.value = await fetchGoalReportStatus(id, toLocalISODate(new Date()))
  }
  catch {
    reportStatus.value = null
  }
}

// Состояние CTA отчёта: 'pending' — есть неотвеченные; 'done' — всё заполнено;
// 'none' — на сегодня вопросов нет (или статус не загрузился).
const reportState = computed<'pending' | 'done' | 'none'>(() => {
  const s = reportStatus.value
  if (!s || s.questions.length === 0)
    return 'none'
  return s.allDone ? 'done' : 'pending'
})

onMounted(async () => {
  try {
    await reloadGoal()
    await loadReportStatus()
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

async function onSaveAdd(v: QuestionWithScheduleItem) {
  saving.value = true
  addError.value = null
  try {
    await addGoalQuestions(id, [v])
    await reloadGoal()
    addingQuestion.value = false
  }
  catch (e: unknown) {
    // fail-fast: Sheet не закрываем, список не трогаем
    addError.value = e instanceof Error ? e.message : 'Не удалось добавить вопрос'
  }
  finally {
    saving.value = false
  }
}

async function onSaveEdit(v: QuestionWithScheduleItem) {
  const q = editingQuestion.value
  if (!q)
    return
  // Если меняется тип у вопроса с уже сохранёнными ответами — предупреждаем
  // о неоднородной интерпретации (answer_text всегда, answer_number/_bool — по типу на момент ответа).
  if (q.type !== v.type) {
    saving.value = true
    saveError.value = null
    try {
      const count = await fetchQuestionAnswerCount(q.id)
      if (count > 0) {
        const snapshot = { value: v, count }
        pendingTypeChangeSnapshot = snapshot
        pendingTypeChange.value = snapshot
        return
      }
    }
    catch (e: unknown) {
      saveError.value = e instanceof Error ? e.message : 'Не удалось проверить ответы'
      return
    }
    finally {
      saving.value = false
    }
  }
  await proceedSaveEdit(v)
}

async function proceedSaveEdit(v: QuestionWithScheduleItem) {
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

async function onConfirmTypeChange() {
  const snap = pendingTypeChangeSnapshot
  if (!snap)
    return
  pendingTypeChangeSnapshot = null
  pendingTypeChange.value = null
  await proceedSaveEdit(snap.value)
}

function onCancelTypeChange() {
  pendingTypeChangeSnapshot = null
  pendingTypeChange.value = null
}

function openDeleteDialog(q: Question) {
  pendingDeletion = q
  deletingQuestion.value = q
}

async function onConfirmDelete() {
  const q = pendingDeletion
  if (!q)
    return
  saving.value = true
  try {
    await deleteQuestion(q.id)
    await reloadGoal()
    pendingDeletion = null
    deletingQuestion.value = null
  }
  catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'Не удалось удалить'
  }
  finally {
    saving.value = false
  }
}

// === Goal-level actions ===

function openGoalAction(action: GoalAction) {
  pendingGoalAction = action
  goalActionPending.value = action
}

const GOAL_ACTION_STATUS: Record<GoalAction, 'active' | 'archived' | 'deleted'> = {
  archive: 'archived',
  delete: 'deleted',
  restore: 'active',
}

const GOAL_ACTION_LABEL: Record<GoalAction, { title: string, body: string, confirm: string, confirmClass?: string }> = {
  archive: {
    title: 'Архивировать цель?',
    body: 'Цель скроется из основного списка, её можно будет восстановить из вкладки «Архив».',
    confirm: 'Архивировать',
  },
  delete: {
    title: 'Удалить цель?',
    body: 'Цель будет помечена как удалённая. Все ответы сохранятся в БД, но цель пропадёт из всех вкладок.',
    confirm: 'Удалить',
    confirmClass: 'bg-destructive text-white hover:bg-destructive/90',
  },
  restore: {
    title: 'Восстановить цель?',
    body: 'Цель снова станет активной и появится во вкладке «Активные».',
    confirm: 'Восстановить',
  },
}

async function onConfirmGoalAction() {
  const action = pendingGoalAction
  if (!action || !goal.value)
    return
  const target = GOAL_ACTION_STATUS[action]
  saving.value = true
  saveError.value = null
  try {
    await updateGoal(goal.value.id, { status: target })
    pendingGoalAction = null
    goalActionPending.value = null
    if (action === 'restore') {
      await reloadGoal()
    }
    else {
      router.push('/')
    }
  }
  catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'Не удалось обновить цель'
  }
  finally {
    saving.value = false
  }
}

function onCancelGoalAction() {
  pendingGoalAction = null
  goalActionPending.value = null
}
</script>

<template>
  <div v-if="loading" class="min-h-screen flex items-center justify-center text-muted-foreground">
    Загрузка...
  </div>

  <div v-else-if="goal">
    <AppHeader :title="goal.goal_name" :show-back="true">
      <template #right>
        <div class="flex items-center gap-2">
          <GoalStatusBadge :status="goal.status" />
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="flex-shrink-0"
                aria-label="Действия с целью"
                data-testid="goal-actions-trigger"
              >
                <MoreVertical class="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <template v-if="goal.status === 'active' || goal.status === 'completed'">
                <DropdownMenuItem data-testid="goal-action-archive" @click="openGoalAction('archive')">
                  <Archive class="w-4 h-4 mr-2" />
                  Архивировать
                </DropdownMenuItem>
                <DropdownMenuItem
                  class="text-destructive focus:text-destructive"
                  data-testid="goal-action-delete"
                  @click="openGoalAction('delete')"
                >
                  <Trash2 class="w-4 h-4 mr-2" />
                  Удалить
                </DropdownMenuItem>
              </template>
              <template v-else-if="goal.status === 'archived'">
                <DropdownMenuItem data-testid="goal-action-restore" @click="openGoalAction('restore')">
                  <RotateCcw class="w-4 h-4 mr-2" />
                  Восстановить
                </DropdownMenuItem>
                <DropdownMenuItem
                  class="text-destructive focus:text-destructive"
                  data-testid="goal-action-delete"
                  @click="openGoalAction('delete')"
                >
                  <Trash2 class="w-4 h-4 mr-2" />
                  Удалить
                </DropdownMenuItem>
              </template>
              <template v-else-if="goal.status === 'deleted'">
                <DropdownMenuItem data-testid="goal-action-restore" @click="openGoalAction('restore')">
                  <RotateCcw class="w-4 h-4 mr-2" />
                  Восстановить
                </DropdownMenuItem>
              </template>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </template>
    </AppHeader>

    <PageContainer class="space-y-8">
      <!-- report CTA -->
      <Button
        v-if="goal.status === 'active' && reportState === 'pending'"
        size="lg"
        class="w-full"
        data-testid="goal-report-cta"
        @click="goToReport"
      >
        Сделать отчёт по цели
      </Button>
      <div
        v-else-if="goal.status === 'active' && reportState === 'done'"
        class="flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
        data-testid="goal-report-done"
      >
        <Check class="size-4 text-green-500" />
        Отчёт на сегодня заполнен
      </div>

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
          <Button
            v-if="goal.status === 'active'"
            size="sm"
            variant="outline"
            data-testid="add-question-cta"
            @click="addingQuestion = true"
          >
            <Plus class="size-4" />
            Добавить вопрос
          </Button>
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
              @click.stop="openDeleteDialog(q)"
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

    <Sheet
      :open="addingQuestion"
      @update:open="(o: boolean) => { if (!o) { addingQuestion = false; addError = null } }"
    >
      <SheetContent class="overflow-y-auto p-6">
        <SheetHeader class="px-0">
          <SheetTitle>Добавить вопрос</SheetTitle>
        </SheetHeader>
        <QuestionEditForm
          v-if="addingQuestion"
          :initial="newQuestionDraft()"
          submit-label="Добавить"
          :error="addError ?? undefined"
          :submitting="saving"
          @save="onSaveAdd"
          @cancel="addingQuestion = false; addError = null"
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

    <AlertDialog
      :open="pendingTypeChange !== null"
      @update:open="(o: boolean) => { if (!o) pendingTypeChange = null }"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Сменить тип вопроса?</AlertDialogTitle>
          <AlertDialogDescription>
            У этого вопроса уже {{ pendingTypeChange?.count }} сохранённых ответов.
            Они останутся в БД, но новый тип может изменить их интерпретацию на графиках и в аналитике.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="onCancelTypeChange">Отмена</AlertDialogCancel>
          <AlertDialogAction data-testid="confirm-type-change" @click="onConfirmTypeChange">
            Продолжить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog
      :open="goalActionPending !== null"
      @update:open="(o: boolean) => { if (!o) goalActionPending = null }"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ goalActionPending ? GOAL_ACTION_LABEL[goalActionPending].title : '' }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{ goalActionPending ? GOAL_ACTION_LABEL[goalActionPending].body : '' }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="onCancelGoalAction">Отмена</AlertDialogCancel>
          <AlertDialogAction
            :class="goalActionPending ? GOAL_ACTION_LABEL[goalActionPending].confirmClass : ''"
            data-testid="confirm-goal-action"
            @click="onConfirmGoalAction"
          >
            {{ goalActionPending ? GOAL_ACTION_LABEL[goalActionPending].confirm : '' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
