<script setup lang="ts">
import type { Component } from 'vue'
import type { QuestionWithScheduleItem } from '@/api/goals'
import { markRaw, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useGoalCreateFlow } from '@/features/goals/model/use-goal-create-flow'
import QuestionEditForm from '@/features/goals/ui/QuestionEditForm.vue'
import CanSkipStep from '@/features/goals/ui/steps/CanSkipStep.vue'
import CreateProgressStep from '@/features/goals/ui/steps/CreateProgressStep.vue'
import EndDateStep from '@/features/goals/ui/steps/EndDateStep.vue'
import IntervalStep from '@/features/goals/ui/steps/IntervalStep.vue'
import NameStep from '@/features/goals/ui/steps/NameStep.vue'
import PointAStep from '@/features/goals/ui/steps/PointAStep.vue'
import QuestionsOfferStep from '@/features/goals/ui/steps/QuestionsOfferStep.vue'
import QuestionTextStep from '@/features/goals/ui/steps/QuestionTextStep.vue'
import QuestionTypeStep from '@/features/goals/ui/steps/QuestionTypeStep.vue'
import SavingStep from '@/features/goals/ui/steps/SavingStep.vue'
import ScheduleStep from '@/features/goals/ui/steps/ScheduleStep.vue'
import StartDateStep from '@/features/goals/ui/steps/StartDateStep.vue'
import TargetValueStep from '@/features/goals/ui/steps/TargetValueStep.vue'
import TypeInDevelopmentStep from '@/features/goals/ui/steps/TypeInDevelopmentStep.vue'
import TypeStep from '@/features/goals/ui/steps/TypeStep.vue'
import WeeklyDaysStep from '@/features/goals/ui/steps/WeeklyDaysStep.vue'

const router = useRouter()
const { state, go, submit } = useGoalCreateFlow()
const error = ref<string>('')
const editingPendingIdx = ref<number | null>(null)

const stepMap: Record<string, Component> = markRaw({
  type: TypeStep,
  type_in_development: TypeInDevelopmentStep,
  name: NameStep,
  start: StartDateStep,
  end: EndDateStep,
  point_a: PointAStep,
  creating: CreateProgressStep,
  questions_offer: QuestionsOfferStep,
  q_type: QuestionTypeStep,
  q_text: QuestionTextStep,
  q_target_value: TargetValueStep,
  q_can_skip: CanSkipStep,
  q_schedule: ScheduleStep,
  q_weekly_days: WeeklyDaysStep,
  q_interval: IntervalStep,
  saving: SavingStep,
})

watch(
  () => state.value.step,
  async (step) => {
    if (step === 'creating') {
      try {
        error.value = ''
        await submit.createGoal()
      }
      catch (e) {
        error.value
          = e instanceof Error ? e.message : 'Не удалось создать цель'
        // composable перевёл шаг на 'creating' до запроса; откатываем на 'point_a'.
        go.back()
      }
    }
    else if (step === 'saving') {
      try {
        error.value = ''
        await submit.saveQuestions()
      }
      catch (e) {
        error.value
          = e instanceof Error ? e.message : 'Не удалось сохранить вопросы'
        // saving — финальный для UI; safest: вернуться на questions_offer, чтобы
        // пользователь мог выйти или попробовать снова.
        // back() из 'saving' в composable — no-op, поэтому сразу редиректим
        // на страницу цели (она уже создана), как и при cancel after-create.
        if (state.value.goalId) {
          router.push({ name: 'goal', params: { id: state.value.goalId } })
        }
      }
    }
    else if (step === 'done') {
      const goalId = state.value.goalId
      if (goalId) {
        router.push({ name: 'goal', params: { id: goalId } })
      }
      else {
        router.push('/')
      }
    }
  },
)

function onCancelConfirmed() {
  const goalId = state.value.goalId
  go.cancel()
  if (goalId) {
    router.push({ name: 'goal', params: { id: goalId } })
  }
  else {
    router.push('/')
  }
}

// Прокидываем все события от шагов в `go.*`. Маппинг 1:1, без логики.
const stepListeners = {
  selectType: go.selectType,
  submitName: go.submitName,
  selectStartPreset: go.selectStartPreset,
  selectEndPreset: go.selectEndPreset,
  setPointA: go.setPointA,
  offerQuestions: go.offerQuestions,
  selectQuestionType: go.selectQuestionType,
  submitQuestionText: go.submitQuestionText,
  submitTargetValue: go.submitTargetValue,
  setCanSkip: go.setCanSkip,
  selectSchedule: go.selectSchedule,
  toggleWeekday: go.toggleWeekday,
  confirmWeekly: go.confirmWeekly,
  setInterval: go.setInterval,
  finishQuestions: go.finishQuestions,
  back: go.back,
  editPendingQuestion: (idx: number) => {
    editingPendingIdx.value = idx
  },
  removePendingQuestion: (idx: number) => {
    go.removeQuestion(idx)
  },
}

function onSavePending(v: QuestionWithScheduleItem) {
  if (editingPendingIdx.value === null)
    return
  go.updateQuestion(editingPendingIdx.value, v)
  editingPendingIdx.value = null
}
</script>

<template>
  <AppHeader title="Создание цели" :show-back="true" />

  <PageContainer>
    <div v-if="error" class="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {{ error }}
    </div>

    <component
      :is="stepMap[state.step]"
      :state="state"
      v-on="stepListeners"
    />

    <div class="mt-6">
      <AlertDialog>
        <AlertDialogTrigger as-child>
          <Button variant="ghost" size="sm" class="text-muted-foreground">
            ❌ Отмена
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить создание цели?</AlertDialogTitle>
            <AlertDialogDescription>
              <template v-if="state.goalId">
                Цель уже создана — её можно открыть и настроить вопросы позже.
              </template>
              <template v-else>
                Введённые данные не сохранятся.
              </template>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Продолжить</AlertDialogCancel>
            <AlertDialogAction
              class="bg-destructive text-white hover:bg-destructive/90"
              @click="onCancelConfirmed"
            >
              Отменить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

    <Sheet
      :open="editingPendingIdx !== null"
      @update:open="(o: boolean) => { if (!o) editingPendingIdx = null }"
    >
      <SheetContent class="overflow-y-auto p-6">
        <SheetHeader class="px-0">
          <SheetTitle>Редактировать вопрос</SheetTitle>
        </SheetHeader>
        <QuestionEditForm
          v-if="editingPendingIdx !== null"
          :initial="state.questionsToAdd[editingPendingIdx]!"
          @save="onSavePending"
          @cancel="editingPendingIdx = null"
        />
      </SheetContent>
    </Sheet>
  </PageContainer>
</template>
