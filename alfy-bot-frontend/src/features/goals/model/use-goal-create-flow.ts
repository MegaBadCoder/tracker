import type { Ref } from 'vue'
import type { CreateGoalDto, QuestionWithScheduleItem } from '@/api/goals'
import type { FrequencyType, QuestionType } from '@/types'
import { readonly, ref } from 'vue'
import {
  addGoalQuestions,
  createGoal,

} from '@/api/goals'
import { toLocalISODate } from '@/features/goals/lib/dates'

export type GoalTypeKey = 'simple' | 'smart' | 'global'

export type Step
  = | 'type'
    | 'type_in_development'
    | 'name'
    | 'start'
    | 'end'
    | 'point_a'
    | 'parent'
    | 'global_deadline'
    | 'creating'
    | 'questions_offer'
    | 'q_type'
    | 'q_text'
    | 'q_target_value'
    | 'q_can_skip'
    | 'q_schedule'
    | 'q_weekly_days'
    | 'q_interval'
    | 'saving'
    | 'done'

export type StartPresetKey = 'today' | 'tomorrow' | 'week' | 'custom'
export type EndPresetKey = 'weeks_12' | 'weeks_24' | 'months_6' | 'year_1' | 'custom'

// Обратная совместимость по именам для существующих импортов.
export type StartPreset = StartPresetKey
export type EndPreset = EndPresetKey

export interface FlowState {
  step: Step
  goalType?: GoalTypeKey
  goalName?: string
  startDate?: Date
  endDate?: Date
  pointA?: boolean
  /** Опциональный дедлайн для global-цели (→ goal_end). */
  deadline?: Date
  /** Опциональный родитель для simple-цели (→ parent_goal_id). */
  parentGoalId?: number
  goalId?: number
  questionsToAdd: QuestionWithScheduleItem[]
  pending: Partial<QuestionWithScheduleItem>
}

function presetStartDate(preset: Exclude<StartPreset, 'custom'>): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (preset === 'tomorrow')
    d.setDate(d.getDate() + 1)
  else if (preset === 'week')
    d.setDate(d.getDate() + 7)
  return d
}

// Зеркало `DATE_DURATIONS` бота: 12 недель / 24 недели / 6 мес / 1 год.
function presetEndDate(start: Date, preset: Exclude<EndPresetKey, 'custom'>): Date {
  const d = new Date(start)
  d.setHours(0, 0, 0, 0)
  switch (preset) {
    case 'weeks_12':
      d.setDate(d.getDate() + 12 * 7)
      break
    case 'weeks_24':
      d.setDate(d.getDate() + 24 * 7)
      break
    case 'months_6':
      d.setMonth(d.getMonth() + 6)
      break
    case 'year_1':
      d.setFullYear(d.getFullYear() + 1)
      break
  }
  return d
}

export interface GoalCreateFlow {
  state: Readonly<Ref<FlowState>>
  go: {
    selectType: (t: GoalTypeKey) => void
    submitName: (s: string) => void
    selectStartPreset: (p: StartPreset, custom?: Date) => void
    selectEndPreset: (p: EndPreset, custom?: Date) => void
    setPointA: (v: boolean) => void
    selectParent: (goalId?: number) => void
    selectDeadline: (date?: Date) => void
    offerQuestions: (yes: boolean) => void
    selectQuestionType: (t: QuestionType) => void
    submitQuestionText: (s: string) => void
    submitTargetValue: (s?: string) => void
    setCanSkip: (v: boolean) => void
    selectSchedule: (t: FrequencyType) => void
    toggleWeekday: (d: number) => void
    confirmWeekly: () => void
    setInterval: (n: number) => void
    addQuestion: () => void
    updateQuestion: (index: number, value: QuestionWithScheduleItem) => void
    removeQuestion: (index: number) => void
    finishQuestions: () => void
    back: () => void
    cancel: () => void
  }
  buildCreatePayload: () => CreateGoalDto
  buildQuestionsPayload: () => QuestionWithScheduleItem[]
  submit: {
    createGoal: () => Promise<number>
    saveQuestions: () => Promise<void>
  }
}

function makeInitialState(): FlowState {
  return {
    step: 'type',
    questionsToAdd: [],
    pending: {},
  }
}

export function useGoalCreateFlow(): GoalCreateFlow {
  const state = ref<FlowState>(makeInitialState())

  function selectType(t: GoalTypeKey): void {
    state.value.goalType = t
    // simple и global ведут на ввод имени; остальные типы — в заглушку.
    state.value.step = t === 'simple' || t === 'global' ? 'name' : 'type_in_development'
  }

  function submitName(s: string): void {
    const trimmed = s.trim()
    if (trimmed.length === 0)
      return
    state.value.goalName = trimmed
    // global: минуем start/end/point_a/questions — сразу к опциональному дедлайну.
    state.value.step = state.value.goalType === 'global' ? 'global_deadline' : 'start'
  }

  function selectStartPreset(p: StartPreset, custom?: Date): void {
    if (p === 'custom') {
      if (!custom)
        return
      state.value.startDate = custom
    }
    else {
      state.value.startDate = presetStartDate(p)
    }
    state.value.step = 'end'
  }

  function selectEndPreset(p: EndPreset, custom?: Date): void {
    const start = state.value.startDate
    if (!start)
      return
    const candidate = p === 'custom' ? custom : presetEndDate(start, p)
    if (!candidate)
      return
    if (candidate.getTime() <= start.getTime()) {
      // Invariant: endDate > startDate. Не двигаем шаг, не сохраняем.
      return
    }
    state.value.endDate = candidate
    state.value.step = 'point_a'
  }

  function setPointA(v: boolean): void {
    state.value.pointA = v
    // simple: предлагаем опциональный выбор родительской global-цели перед созданием.
    state.value.step = 'parent'
  }

  function selectParent(goalId?: number): void {
    if (goalId !== undefined)
      state.value.parentGoalId = goalId
    else
      delete state.value.parentGoalId
    state.value.step = 'creating'
  }

  function selectDeadline(date?: Date): void {
    if (date !== undefined)
      state.value.deadline = date
    else
      delete state.value.deadline
    state.value.step = 'creating'
  }

  function offerQuestions(yes: boolean): void {
    if (yes) {
      state.value.pending = {}
      state.value.step = 'q_type'
    }
    else if (state.value.questionsToAdd.length > 0) {
      state.value.step = 'saving'
    }
    else {
      state.value.step = 'done'
    }
  }

  function finishQuestions(): void {
    if (state.value.questionsToAdd.length === 0)
      return
    state.value.step = 'saving'
  }

  function selectQuestionType(t: QuestionType): void {
    state.value.pending.type = t
    state.value.step = 'q_text'
  }

  function submitQuestionText(s: string): void {
    const trimmed = s.trim()
    if (trimmed.length === 0)
      return
    state.value.pending.question = trimmed
    if (state.value.pending.type === 'number') {
      state.value.step = 'q_target_value'
    }
    else {
      state.value.step = 'q_can_skip'
    }
  }

  function submitTargetValue(s?: string): void {
    if (s !== undefined && s.trim().length > 0) {
      state.value.pending.targetValue = s.trim()
    }
    else {
      delete state.value.pending.targetValue
    }
    state.value.step = 'q_can_skip'
  }

  function setCanSkip(v: boolean): void {
    state.value.pending.canSkip = v
    state.value.step = 'q_schedule'
  }

  function selectSchedule(t: FrequencyType): void {
    state.value.pending.scheduleType = t
    if (t === 'daily') {
      finalizePendingQuestion()
    }
    else if (t === 'weekly_days') {
      state.value.pending.selectedDays = []
      state.value.step = 'q_weekly_days'
    }
    else if (t === 'interval') {
      state.value.step = 'q_interval'
    }
  }

  function toggleWeekday(d: number): void {
    const days = state.value.pending.selectedDays ?? []
    const idx = days.indexOf(d)
    if (idx === -1) {
      state.value.pending.selectedDays = [...days, d].sort((a, b) => a - b)
    }
    else {
      state.value.pending.selectedDays = days.filter(x => x !== d)
    }
  }

  function confirmWeekly(): void {
    const days = state.value.pending.selectedDays ?? []
    if (days.length < 1)
      return
    finalizePendingQuestion()
  }

  function setInterval(n: number): void {
    if (!Number.isInteger(n) || n < 1)
      return
    state.value.pending.intervalDays = n
    finalizePendingQuestion()
  }

  function finalizePendingQuestion(): void {
    const p = state.value.pending
    if (
      p.question === undefined
      || p.type === undefined
      || p.canSkip === undefined
      || p.scheduleType === undefined
    ) {
      // Не завершено — игнорируем (защитный barrier; в норме не достижим).
      return
    }
    const item: QuestionWithScheduleItem = {
      question: p.question,
      type: p.type,
      canSkip: p.canSkip,
      scheduleType: p.scheduleType,
    }
    if (p.type === 'number' && p.targetValue !== undefined) {
      item.targetValue = p.targetValue
    }
    if (p.scheduleType === 'weekly_days' && p.selectedDays && p.selectedDays.length > 0) {
      item.selectedDays = [...p.selectedDays]
    }
    if (p.scheduleType === 'interval' && p.intervalDays !== undefined) {
      item.intervalDays = p.intervalDays
    }
    state.value.questionsToAdd.push(item)
    state.value.pending = {}
    state.value.step = 'q_type'
  }

  function addQuestion(): void {
    // alias для UI: «добавить ещё один вопрос» — переход к выбору типа.
    state.value.pending = {}
    state.value.step = 'q_type'
  }

  function updateQuestion(index: number, value: QuestionWithScheduleItem): void {
    if (index < 0 || index >= state.value.questionsToAdd.length)
      return
    state.value.questionsToAdd.splice(index, 1, value)
  }

  function removeQuestion(index: number): void {
    if (index < 0 || index >= state.value.questionsToAdd.length)
      return
    state.value.questionsToAdd.splice(index, 1)
  }

  function back(): void {
    switch (state.value.step) {
      case 'type':
        // нечего откатывать
        return
      case 'type_in_development':
        state.value.goalType = undefined
        state.value.step = 'type'
        return
      case 'name':
        state.value.goalType = undefined
        state.value.step = 'type'
        return
      case 'global_deadline':
        // global: единственный предшествующий шаг — name.
        state.value.deadline = undefined
        state.value.step = 'name'
        return
      case 'start':
        state.value.goalName = undefined
        state.value.step = 'name'
        return
      case 'end':
        state.value.startDate = undefined
        state.value.step = 'start'
        return
      case 'point_a':
        state.value.endDate = undefined
        state.value.step = 'end'
        return
      case 'parent':
        state.value.parentGoalId = undefined
        state.value.step = 'point_a'
        return
      case 'creating':
        // simple приходит сюда из 'parent', global — из 'global_deadline'.
        if (state.value.goalType === 'global') {
          state.value.step = 'global_deadline'
        }
        else {
          state.value.parentGoalId = undefined
          state.value.step = 'parent'
        }
        return
      case 'questions_offer':
        // цель уже создана — назад не пускаем; ничего не делаем.
        return
      case 'q_type':
        state.value.step = 'questions_offer'
        return
      case 'q_text':
        state.value.pending.question = undefined
        state.value.pending.type = undefined
        state.value.step = 'q_type'
        return
      case 'q_target_value':
        delete state.value.pending.targetValue
        state.value.step = 'q_text'
        return
      case 'q_can_skip':
        state.value.pending.canSkip = undefined
        // для number возвращаемся на q_target_value, для остальных — на q_text
        state.value.step = state.value.pending.type === 'number' ? 'q_target_value' : 'q_text'
        return
      case 'q_schedule':
        state.value.pending.canSkip = undefined
        state.value.pending.scheduleType = undefined
        state.value.step = 'q_can_skip'
        return
      case 'q_weekly_days':
        state.value.pending.selectedDays = undefined
        state.value.pending.scheduleType = undefined
        state.value.step = 'q_schedule'
        return
      case 'q_interval':
        state.value.pending.intervalDays = undefined
        state.value.pending.scheduleType = undefined
        state.value.step = 'q_schedule'
        break
      case 'saving':
      case 'done':
        // saving/done — финальные; назад из них не предусмотрен.
        break
    }
  }

  function cancel(): void {
    state.value = makeInitialState()
  }

  function buildCreatePayload(): CreateGoalDto {
    const { goalType, goalName, startDate, endDate, deadline, parentGoalId } = state.value
    if (!goalName) {
      throw new Error('buildCreatePayload: goalName must be set')
    }
    if (goalType === 'global') {
      // global: даты опциональны. Только дедлайн (→ goal_end), если задан.
      const payload: CreateGoalDto = {
        goal_name: goalName,
        is_global: true,
      }
      if (deadline) {
        payload.goal_end = toLocalISODate(deadline)
      }
      return payload
    }
    // simple: даты обязательны, родитель опционален.
    if (!startDate || !endDate) {
      throw new Error('buildCreatePayload: goalName/startDate/endDate must be set')
    }
    const payload: CreateGoalDto = {
      goal_name: goalName,
      goal_start: toLocalISODate(startDate),
      goal_end: toLocalISODate(endDate),
    }
    if (parentGoalId !== undefined) {
      payload.parent_goal_id = parentGoalId
    }
    return payload
  }

  function buildQuestionsPayload(): QuestionWithScheduleItem[] {
    return state.value.questionsToAdd.map(q => ({ ...q }))
  }

  async function submitCreateGoal(): Promise<number> {
    state.value.step = 'creating'
    const payload = buildCreatePayload()
    const goal = await createGoal(payload)
    state.value.goalId = goal.id
    // global-цели не получают вопросов — сразу завершаем поток.
    state.value.step = state.value.goalType === 'global' ? 'done' : 'questions_offer'
    return goal.id
  }

  async function submitSaveQuestions(): Promise<void> {
    const goalId = state.value.goalId
    if (!goalId) {
      throw new Error('submitSaveQuestions: goalId must be set (createGoal must run first)')
    }
    state.value.step = 'saving'
    const items = buildQuestionsPayload()
    if (items.length > 0) {
      await addGoalQuestions(goalId, items)
    }
    state.value.step = 'done'
  }

  return {
    state: readonly(state) as Readonly<Ref<FlowState>>,
    go: {
      selectType,
      submitName,
      selectStartPreset,
      selectEndPreset,
      setPointA,
      selectParent,
      selectDeadline,
      offerQuestions,
      selectQuestionType,
      submitQuestionText,
      submitTargetValue,
      setCanSkip,
      selectSchedule,
      toggleWeekday,
      confirmWeekly,
      setInterval,
      addQuestion,
      updateQuestion,
      removeQuestion,
      finishQuestions,
      back,
      cancel,
    },
    buildCreatePayload,
    buildQuestionsPayload,
    submit: {
      createGoal: submitCreateGoal,
      saveQuestions: submitSaveQuestions,
    },
  }
}
