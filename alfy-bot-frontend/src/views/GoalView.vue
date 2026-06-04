<script setup lang="ts">
import type { QuestionWithScheduleItem } from '../api/goals'
import type { Goal, Question } from '../types'
import { Archive, ChevronRight, MoreVertical, MoveUpRight, Pencil, Plus, RotateCcw, Trash2, Unlink } from 'lucide-vue-next'
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
import QuestionEditForm from '@/features/goals/ui/QuestionEditForm.vue'
import {
  deleteQuestion,
  fetchGoalById,
  fetchGoals,
  fetchQuestionAnswerCount,
  updateGoal,
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

// Родительская global-цель (если текущая цель привязана к ней).
const parentGoal = ref<Goal | null>(null)

async function reloadGoal() {
  goal.value = await fetchGoalById(id)
  if (goal.value.parent_goal_id) {
    try {
      parentGoal.value = await fetchGoalById(goal.value.parent_goal_id)
    }
    catch {
      // Родителя не удалось загрузить — не блокируем просмотр цели.
      parentGoal.value = null
    }
  }
  else {
    parentGoal.value = null
  }
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
const daysLeftVal = computed(() =>
  goal.value?.goal_end ? daysLeft(goal.value.goal_end) : 0,
)
// Показываем блок дат только если у цели есть хотя бы одна дата
// (бессрочные global-цели создаются без дат).
const hasDates = computed(() => Boolean(goal.value?.goal_start || goal.value?.goal_end))

function goToChild(child: { id: number }) {
  return router.push({ name: 'goal', params: { id: child.id } })
}

function goToCreateHere() {
  return router.push({ name: 'goal-create' })
}

// === Перенос regular-цели в global / открепление ===
const moveSheetOpen = ref(false)
const globalGoals = ref<Goal[]>([])
const globalsLoading = ref(false)
const moveError = ref<string | null>(null)

async function openMoveSheet() {
  moveSheetOpen.value = true
  moveError.value = null
  globalsLoading.value = true
  try {
    globalGoals.value = await fetchGoals({ scope: 'global' })
  }
  catch (e: unknown) {
    moveError.value = e instanceof Error ? e.message : 'Не удалось загрузить глобальные цели'
  }
  finally {
    globalsLoading.value = false
  }
}

async function onMoveToGlobal(parentId: number) {
  if (!goal.value)
    return
  saving.value = true
  moveError.value = null
  try {
    await updateGoal(goal.value.id, { parent_goal_id: parentId })
    moveSheetOpen.value = false
    await reloadGoal()
  }
  catch (e: unknown) {
    moveError.value = e instanceof Error ? e.message : 'Не удалось перенести цель'
  }
  finally {
    saving.value = false
  }
}

async function onUnlinkParent() {
  if (!goal.value)
    return
  saving.value = true
  saveError.value = null
  try {
    await updateGoal(goal.value.id, { parent_goal_id: null })
    await reloadGoal()
  }
  catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'Не удалось открепить цель'
  }
  finally {
    saving.value = false
  }
}

function goToParent() {
  if (!goal.value?.parent_goal_id)
    return
  return router.push({ name: 'goal', params: { id: goal.value.parent_goal_id } })
}

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
              <template v-if="!goal.is_global && goal.status !== 'deleted'">
                <DropdownMenuItem data-testid="goal-action-move" @click="openMoveSheet">
                  <MoveUpRight class="w-4 h-4 mr-2" />
                  Переместить в глобальную цель
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="goal.parent_goal_id"
                  data-testid="goal-action-unlink"
                  @click="onUnlinkParent"
                >
                  <Unlink class="w-4 h-4 mr-2" />
                  Открепить
                </DropdownMenuItem>
              </template>
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
      <!-- parent link (regular goal under a global parent) -->
      <button
        v-if="!goal.is_global && parentGoal"
        type="button"
        class="w-full flex items-center gap-2 text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
        data-testid="parent-goal-link"
        @click="goToParent"
      >
        <span class="shrink-0">↑</span>
        <span class="truncate">Родительская цель: {{ parentGoal.goal_name }}</span>
      </button>

      <!-- summary (скрываем блок дат у бессрочных целей без дат) -->
      <section v-if="hasDates">
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <SummaryCard label="Начало" :value="goal.goal_start ? formatDate(goal.goal_start) : '—'" />
          <SummaryCard label="Конец" :value="goal.goal_end ? formatDate(goal.goal_end) : '—'" />
          <SummaryCard
            label="Дней до конца"
            :value="goal.status === 'completed' ? '—' : daysLeftVal > 0 ? daysLeftVal : 'Истёк'"
            :sub="goal.status === 'completed' ? 'Цель завершена' : undefined"
            :accent="goal.status === 'active' && daysLeftVal > 0"
          />
        </div>
      </section>

      <!-- children (global goal) -->
      <section v-if="goal.is_global">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-semibold text-foreground">
            Цели внутри
          </h2>
          <Button size="sm" variant="outline" data-testid="create-child-goal" @click="goToCreateHere">
            <Plus class="w-4 h-4 mr-1" />
            Создать цель здесь
          </Button>
        </div>
        <div v-if="(goal.children?.length ?? 0) > 0" class="space-y-2">
          <button
            v-for="child in goal.children"
            :key="child.id"
            type="button"
            class="w-full flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 text-left transition-all duration-150 hover:bg-accent hover:border-accent hover:shadow-sm active:scale-[0.98]"
            :data-testid="`child-goal-${child.id}`"
            @click="goToChild(child)"
          >
            <div
              class="w-1 h-8 rounded-full shrink-0"
              :style="{ backgroundColor: goalAccent(child.id) }"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-foreground truncate">
                {{ child.goal_name }}
              </p>
            </div>
            <ChevronRight class="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </div>
        <p v-else class="text-sm text-muted-foreground">
          Пока нет вложенных целей. Создайте первую — она будет привязана к этой глобальной цели.
        </p>
      </section>

      <!-- questions (regular goal) -->
      <section v-else>
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
          <AlertDialogCancel @click="onCancelTypeChange">
            Отмена
          </AlertDialogCancel>
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
          <AlertDialogCancel @click="onCancelGoalAction">
            Отмена
          </AlertDialogCancel>
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

    <Sheet
      :open="moveSheetOpen"
      @update:open="(o: boolean) => { if (!o) moveSheetOpen = false }"
    >
      <SheetContent class="overflow-y-auto p-6">
        <SheetHeader class="px-0">
          <SheetTitle>Переместить в глобальную цель</SheetTitle>
        </SheetHeader>
        <div class="mt-4 space-y-2">
          <p v-if="globalsLoading" class="text-sm text-muted-foreground">
            Загрузка...
          </p>
          <p v-else-if="moveError" class="text-sm text-destructive">
            {{ moveError }}
          </p>
          <p v-else-if="globalGoals.length === 0" class="text-sm text-muted-foreground">
            Пока нет глобальных целей.
          </p>
          <button
            v-for="g in globalGoals"
            v-else
            :key="g.id"
            type="button"
            class="w-full flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3 text-left transition-all duration-150 hover:bg-accent hover:border-accent disabled:opacity-50"
            :disabled="saving || g.id === goal.parent_goal_id"
            :data-testid="`move-target-${g.id}`"
            @click="onMoveToGlobal(g.id)"
          >
            <span class="shrink-0">🌍</span>
            <span class="flex-1 min-w-0 truncate text-sm font-medium text-foreground">{{ g.goal_name }}</span>
            <span v-if="g.id === goal.parent_goal_id" class="text-xs text-muted-foreground shrink-0">текущий</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
