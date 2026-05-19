# Goal Questions — Edit & Delete

**Status:** done
**Branch:** feat/goals-management-ui
**Worktree:** .worktrees/feat-goals-management-ui
**Mode:** interactive

## Design

### Цель

Добавить редактирование и удаление вопросов в двух местах:

1. **GoalView** (`/goals/:id`) — для уже сохранённых вопросов сохранённой цели.
2. **GoalCreateView** (`/goals/new`) — для вопросов из `state.questionsToAdd`, ещё не отправленных на бэк.

### Scope

В рамках задачи:

1. **Frontend API** (`api/goals.ts`):
   - Расширить `updateQuestion()` — сейчас он принимает только `{ is_habit?, question? }`, добавить `type`, `can_skip`, `target_value` (бэк уже всё это умеет через `UpdateQuestionDto`).
   - Добавить `deleteQuestion(questionId: number): Promise<void>` → `DELETE /questions/:id`.
   - `updateQuestionSchedule()` уже есть — переиспользуем.

2. **Новый компонент** `features/goals/ui/QuestionEditForm.vue` — плоская форма со всеми полями вопроса (type, text, [target_value], can_skip, scheduleType, weekly_days / interval_days). Принимает initial `value: QuestionWithScheduleItem & { id?: number }` (id присутствует у сохранённых, отсутствует у pending). Эмитит `save(value)` и `cancel()`. Используется в обоих кейсах ниже.

3. **GoalView** — на каждой карточке вопроса (`.../views/GoalView.vue:80-99`) добавить два icon-button'а справа: «edit» (Pencil из lucide) и «trash» (Trash2). Оба с `@click.stop`. По edit — открывается shadcn-vue `Sheet` или `Dialog` с `QuestionEditForm`. По trash — `AlertDialog` confirm → `DELETE /questions/:id` → перезагрузить goal. Submit формы → `updateQuestion()` + (если расписание изменилось) `updateQuestionSchedule()` → перезагрузить goal.

4. **GoalCreateView edit pending questions**:
   - На шаге `q_type` (`features/goals/ui/steps/QuestionTypeStep.vue`) где сейчас показан только счётчик «Добавлено вопросов: N» — заменить на список добавленных с edit/trash icons (компактные карточки: вопрос-текст + тип-бейдж + расписание-инфо).
   - По edit — открывается тот же Sheet/Dialog с `QuestionEditForm`. Submit → мутирует `state.questionsToAdd[idx]` через новый метод composable `go.updateQuestion(idx, value)`.
   - По trash → AlertDialog confirm → `go.removeQuestion(idx)` (splice).

5. **Composable** (`use-goal-create-flow.ts`) — добавить два метода:
   - `updateQuestion(index: number, value: QuestionWithScheduleItem): void`
   - `removeQuestion(index: number): void`
   Оба чистые операции над массивом `questionsToAdd`.

Вне scope:
- Восстановление soft-deleted вопросов (бэк не имеет endpoint'а; матчит UX бота).
- Drag-reorder вопросов.
- Bulk-операции.
- Bot-scene `edit-goal.scene.ts` не трогаем.

### Выбранный подход

**Single edit form, dual usage**. `QuestionEditForm.vue` — плоская форма со всеми полями. Step-компоненты flow создания (`QuestionTypeStep`, `QuestionTextStep`, …) остаются как есть — они tightly coupled к state-машине, рефакторить их не стоит (YAGNI). Sheet/Dialog оборачивает форму в двух местах вызова.

Tradeoff: дублирование UI (поля типа вопроса и расписания приходится рендерить и в step-компонентах, и в `QuestionEditForm`). Это сознательный выбор — flow-шаги «вертикальный» pacing (один-вопрос-один-экран) zerkalit бот, а edit-форма «плоская» (все поля сразу) лучше для редактирования. Семантически разные UX'ы, держать раздельно.

Альтернатива A — заинклудить step-компоненты в Sheet как маленький wizard — отвергнута: усложняет state composable'а (вторая state-машина внутри Sheet) и UX edit'а становится медленным (4-5 кликов чтобы поменять одно поле).

Альтернатива B — отдельная страница `/questions/:id/edit` — отвергнута по итогам клиэнтского выбора (Sheet/Dialog требует меньше переходов).

### Backwards-compat

Минимальные риски, в основном additive:

- `updateQuestion()` во фронт-API получает новые опциональные поля (`type`, `can_skip`, `target_value`). Существующие вызовы (`features/habits/...`, `views/QuestionReportView.vue`) — проверить, что не сломаются (поля optional → не сломаются). **В Plan — grep консьюмеров.**
- `DELETE /questions/:id` (soft-delete) уже работает, фильтр `q.is_active` в `GoalView` уже стоит (`alfy-bot-frontend/src/views/GoalView.vue:82`) — удалённые автоматически скроются.
- Бэкенд не меняется.
- Composable signature расширяется двумя методами — additive, существующие тесты не падают.

### Поведение edit-формы для сохранённого вопроса

Поля формы инициализируются из `Question` + текущего `Schedule`. После Save:

1. Если изменились text/type/can_skip/target_value — `PATCH /questions/:id` (один батч-вызов).
2. Если изменилось расписание (`frequency_type` / `days_of_week` / `interval_days`) — отдельный `PATCH /questions/:id/schedule`.
3. На любую ошибку — inline-баннер в Sheet, форма не закрывается.
4. После успеха — закрыть Sheet, перезагрузить goal через `fetchGoalById`.

Сравнение «изменилось / нет» — diff текущих значений с initial. Если ничего не изменилось — Save является no-op (можно дисэйблить кнопку, но не обязательно).

**Type change при наличии ответов**: бэк разрешает, ответы остаются как есть. Не предупреждаем (YAGNI — добавим, если пользователи начнут жаловаться). Грубое изменение типа — ответственность пользователя.

### Поведение edit-формы для pending вопроса

Идентичная форма, но Save мутирует `state.questionsToAdd[idx]` (через composable `go.updateQuestion(idx, value)`) и закрывает Sheet. Никаких API-вызовов.

### TDD

TDD: yes для composable-методов `updateQuestion(idx, v)` и `removeQuestion(idx)` (детерминированная reusable-логика; легко регрессировать). Для UI-компонентов — smoke-тест-уровень, не TDD.

### Open questions / risks

- Если в `QuestionEditForm` пользователь меняет `scheduleType` с `weekly_days` на `daily` — старые `selectedDays` должны очиститься в payload (не отправлять «мёртвые» поля). Зеркало композабла `buildQuestionsPayload`.
- Если в pending-edit пользователь меняет type с number на text — `targetValue` должен удалиться (как в композабле).

### Invariants

- `QuestionEditForm` не отправляет `targetValue`, если итоговый `type !== 'number'`.
- `QuestionEditForm` не отправляет `selectedDays`, если итоговый `scheduleType !== 'weekly_days'`; не отправляет `intervalDays`, если `!== 'interval'`.
- Delete на сохранённом вопросе — `DELETE /questions/:id` (soft, через `is_active = false`), без подтверждения уничтожения данных; всегда через `AlertDialog` confirm.
- Delete на pending вопросе — splice массива, без API.
- Edit/delete buttons на карточке вопроса в GoalView имеют `@click.stop` (не триггерят навигацию на отчёт).
- Step-компоненты flow (`QuestionTypeStep`, `QuestionTextStep`, ...) НЕ модифицируются (только `QuestionTypeStep.vue` — туда добавляется список pending-вопросов).
- Бот-scenes не модифицируются.
- composable: `updateQuestion(idx, v)` и `removeQuestion(idx)` чистые операции, не меняют `state.step`.

### Principles

- Одна форма, два контекста — Sheet/Dialog с `QuestionEditForm` в обоих местах.
- Step-flow для создания, плоская форма для редактирования — НЕ смешивать.
- shadcn-vue first (`Sheet`, `AlertDialog`, `Button`, `Input`); icon-ы из `lucide-vue-next` (уже в зависимостях).
- YAGNI: никаких bulk-операций, drag-reorder, восстановления удалённых.

TDD: yes (composable updateQuestion/removeQuestion; UI — smoke)

## Plan

Approach: расширить `api/goals.ts` (расширенный `updateQuestion`, новый `deleteQuestion`) + два чистых composable-метода (TDD), затем построить плоскую `QuestionEditForm.vue`, и в третью фазу — провязать её в `GoalCreateView` (pending) и `GoalView` (saved).

### Phase 1 — API + composable (TDD)

- **1.1** `alfy-bot-frontend/tests/features/goals/use-goal-create-flow.spec.ts` (modify — добавить tests, **failing first**)
  - `updateQuestion(idx, value)` подменяет элемент `questionsToAdd[idx]` целиком; не меняет `state.step`.
  - `removeQuestion(idx)` вырезает элемент; не меняет `state.step`; не мутирует другие индексы (проверка `questionsToAdd.length`, идентичности соседей).
  - `updateQuestion` с `idx` вне диапазона — no-op.
  - `removeQuestion` с `idx` вне диапазона — no-op.
- **1.2** `alfy-bot-frontend/src/features/goals/model/use-goal-create-flow.ts:82-101` (modify type-block) и `:407-435` (modify return)
  - В `Returns.go` добавить:
    ```ts
    updateQuestion: (index: number, value: QuestionWithScheduleItem) => void
    removeQuestion: (index: number) => void
    ```
  - Реализации — чистые операции над `state.value.questionsToAdd` через `splice(idx, 1, value)` и `splice(idx, 1)`. Guard на `idx < 0 || idx >= length`.
  - Invariants: «composable: updateQuestion/removeQuestion не меняют state.step»; «pending edit/delete без API».
- **1.3** `alfy-bot-frontend/src/api/goals.ts:48-54` (modify `updateQuestion`)
  - Сменить сигнатуру:
    ```ts
    export interface UpdateQuestionDto {
      question?: string
      type?: QuestionType
      can_skip?: boolean
      is_habit?: boolean
      target_value?: string | null
    }
    export async function updateQuestion(questionId: number, dto: UpdateQuestionDto): Promise<Question>
    ```
  - Все поля optional → существующие вызовы (`QuestionReportView.vue:55,67`) с узкими payload'ами продолжают работать.
- **1.4** `alfy-bot-frontend/src/api/goals.ts` (modify — добавить `deleteQuestion`)
  - ```ts
    export async function deleteQuestion(questionId: number): Promise<void> {
      await api.delete(`/questions/${questionId}`)
    }
    ```
  - Invariants: «delete сохранённого — `DELETE /questions/:id` (soft)».
- Commit: `feat(goals): composable updateQuestion/removeQuestion + API updateQuestion/deleteQuestion`

### Phase 2 — QuestionEditForm (плоская форма)

- **2.1** `alfy-bot-frontend/src/features/goals/ui/QuestionEditForm.vue` (create)
  - Props:
    ```ts
    defineProps<{
      initial: QuestionWithScheduleItem  // pending shape (универсальная)
      submitLabel?: string  // дефолт 'Сохранить'
      error?: string  // inline error баннер из родителя
      submitting?: boolean  // блокирует Save во время API-вызова
    }>()
    const emit = defineEmits<{
      (e: 'save', value: QuestionWithScheduleItem): void
      (e: 'cancel'): void
    }>()
    ```
  - Layout (top-down, плоский, без stepper):
    1. RadioGroup-like (Button-row) — тип вопроса (6 опций из `./steps/question-types`).
    2. `Input` — текст вопроса.
    3. `Input type="text" inputmode="numeric"` — target_value (рендерится только если `type === 'number'`).
    4. Button-row Да/Нет — can_skip.
    5. Button-row — scheduleType (daily/weekly_days/interval).
    6. Day-picker (когда weekly_days) — реюз UI с `WeeklyDaysStep`, локально.
    7. Number Input для intervalDays (когда interval, с пресетами 2/3/7/14).
    8. Footer: `Button` Save (`variant="default"`), `Button` Cancel (`variant="outline"`).
  - На каждый чейндж — локальный reactive draft, по Save — собрать `QuestionWithScheduleItem`, очистить мёртвые поля:
    - `targetValue` есть только при `type === 'number'`
    - `selectedDays` есть только при `scheduleType === 'weekly_days'`
    - `intervalDays` есть только при `scheduleType === 'interval'`
  - Тип в payload собирать через локальный `buildPayload()` (без импорта из composable — composable отвечает только за flow-цели).
  - Invariants: «не отправляем targetValue если type !== number»; «selectedDays/intervalDays только для своих scheduleType».
- **2.2** `alfy-bot-frontend/tests/features/goals/QuestionEditForm.spec.ts` (create — smoke)
  - Рендер с `initial: { type: 'number', targetValue: '50', ... }` — target_value показан, значение 50.
  - При смене type на `'text'` — target_value скрывается.
  - При Save — emit `'save'` с очищенным payload (без `targetValue`).
  - Cancel — emit `'cancel'`.
- Commit: `feat(goals): QuestionEditForm плоская форма для редактирования вопроса`

### Phase 3 — Wire edit/delete в GoalCreateView и GoalView

- **3.1** `alfy-bot-frontend/src/features/goals/ui/steps/QuestionTypeStep.vue:14-52` (modify)
  - Заменить «Добавлено вопросов: N» на список карточек: для каждого `state.questionsToAdd[idx]` — текст-вопроса, тип-бейдж, schedule-summary, плюс два icon-button'а (Pencil, Trash2 из `lucide-vue-next`) справа.
  - Edit emit `editPendingQuestion(idx)`.
  - Delete → локальный `AlertDialog` → emit `removePendingQuestion(idx)`.
  - Если список пустой — старого баннера нет (изменение визуала, но не functional regression).
  - Добавить `defineEmits` events `editPendingQuestion(idx: number)` и `removePendingQuestion(idx: number)`.
  - Invariants: «step-компоненты flow НЕ модифицируются (кроме QuestionTypeStep, как раз сюда добавляется список)».
- **3.2** `alfy-bot-frontend/src/views/GoalCreateView.vue:115-132` (modify — добавить локальный edit-sheet и wirings)
  - Импортировать `QuestionEditForm` и `Sheet/SheetContent/SheetTitle/SheetHeader`.
  - Локальные refs: `editingPendingIdx: ref<number | null>(null)`.
  - В `stepListeners` добавить `editPendingQuestion` (открывает Sheet с initial = `state.questionsToAdd[idx]`) и `removePendingQuestion` (вызывает `go.removeQuestion(idx)`).
  - В template — `<Sheet :open="editingPendingIdx !== null" @update:open="…">` со `<QuestionEditForm :initial="state.questionsToAdd[editingPendingIdx!]" @save="onSavePending" @cancel="editingPendingIdx = null" />`. `onSavePending(v)` → `go.updateQuestion(idx, v)` + закрыть Sheet.
- **3.3** `alfy-bot-frontend/src/views/GoalView.vue:75-100` (modify)
  - На каждой `<button v-for="q in goal.questions...">` добавить два icon-button'а справа: Pencil (`@click.stop="openEdit(q)"`) и Trash2 (`@click.stop="confirmDelete(q)"`). Кнопки реализовать как `<button>` с classами для tap-area (по 32px); НЕ заворачивать в `<Button>` чтобы не разламывать структуру внешнего `<button>` (nested button — невалидный HTML).
  - **Структурный фикс**: текущий `<button class="...">` оборачивает всю карточку. Чтобы вложить интерактивные элементы, заменить внешний `<button>` на `<div role="button">` или `<router-link>` (точнее — на `<div>` с click handler на основной части и icon-кнопками внутри). Альтернативно — карточка `<div>`, отдельная зона клика для деталей. Выберу `<div>` с двумя вложенными `<button>`: одна — большая область клика на отчёт, вторая и третья — icon-кнопки. **stopPropagation на icon-кнопках обязателен.**
  - Локальные refs: `editingQuestion: ref<Question | null>(null)`, `deletingQuestion: ref<Question | null>(null)`, `saving: ref(false)`, `error: ref<string | null>(null)`.
  - Sheet с `QuestionEditForm` для редактирования: `initial` собирается из `Question` + его `Schedule` (через хелпер `questionToFormValue(q)`).
  - На Save: вычислить diff initial vs new, если поменялись текст/тип/can_skip/target_value — `updateQuestion(id, dto)`; если поменялся schedule — `updateQuestionSchedule(id, dto)`. После всех успешных запросов — `await reloadGoal()` (вынести в локальную функцию), закрыть Sheet.
  - На Delete — `AlertDialog` confirm → `deleteQuestion(q.id)` → `reloadGoal()`.
  - Invariants: «edit/delete buttons с @click.stop»; «delete сохранённого — через AlertDialog confirm»; «soft delete (фильтр `q.is_active` уже стоит) — удалённые автоматически скроются после reload».
- **3.4** `alfy-bot-frontend/tests/views/GoalCreateView.spec.ts` (modify — добавить smoke)
  - Существующий smoke остаётся. Добавить: добавить вопрос через flow в `q_type` → проверить, что карточка вопроса видна в списке + icon-кнопки edit/delete присутствуют.
- Commit: `feat(goals): edit/delete вопросов в GoalView и GoalCreateView`

### Test strategy

- **Phase 1** TDD: 4 composable-тестa из 1.1 (failing first).
- **Phase 2**: 4 smoke-теста QuestionEditForm.
- **Phase 3**: расширенный smoke GoalCreateView; UI GoalView без юнит-теста (вне scope smoke — visual flow проверяется в browser smoke).

### Order & dependencies

Phase 1 (API + composable) блокирует Phase 3. Phase 2 (форма) не зависит от Phase 1 — параллелизуема, но при последовательной работе делаем 1→2→3.

### Backwards-compat

Per Design: `updateQuestion` фронт-API расширяется (все новые поля optional) → консьюмеры `QuestionReportView.vue:55,67` продолжают работать (узкие payload'ы `{ question }` и `{ is_habit }` валидны и в новой сигнатуре). Verified: grep показал ровно 2 консьюмера, оба тривиальные. Бэкенд не меняется. Step-flow создания цели не меняется (кроме add'ed-списка в `QuestionTypeStep`).

### Open questions / risks

- В Phase 3.3 структурный фикс GoalView (замена внешнего `<button>` на `<div>` с вложенными кнопками) — небольшой риск регрессии click-into-report. Митигейт: явный smoke в browser после фазы.
- `QuestionEditForm` использует ту же логику payload-build, что и `buildQuestionsPayload` в composable — небольшая дубликация. Сознательная, **YAGNI** не выносить в shared util (используется в 2 местах с разной семантикой).

## Verify

**Result:** passed

Positive:
- backend tests: 6/6 в `goal.controller.spec.ts` (unchanged this task)
- frontend tests: 33/33 (`use-goal-create-flow.spec.ts` 25 + `QuestionEditForm.spec.ts` 4 + `GoalCreateView.spec.ts` 4)
- type-check: clean (`npx vue-tsc --noEmit -p tsconfig.app.json`)
- live smoke (GoalView `/goals/16`): edit вопроса → `PATCH /questions/:id` → текст обновился; delete → `AlertDialog` confirm → `DELETE /questions/:id` → reload → questions count 1→0
- live smoke (GoalCreateView `/goals/new`): pending edit через `Sheet` + `QuestionEditForm` (форма инициализируется из элемента `questionsToAdd[idx]`); pending delete → `AlertDialog` confirm → splice → count 1→0

Negative:
- `AlertDialog` confirm для saved/pending — оба требуют подтверждения (visible в browser)

Invariants:
- бот-scenes/Goal entity не модифицированы: `git diff --stat origin/main..HEAD -- alfy-bot/src/modules/bot/ alfy-bot/src/shared/entities/goal.entity.ts` → пусто
- step-компоненты flow (кроме `QuestionTypeStep`) НЕ модифицированы: `git diff --stat origin/main..HEAD -- 'alfy-bot-frontend/src/features/goals/ui/steps/*.vue'` | без QuestionTypeStep → 0 file changes
- `QuestionEditForm` payload-build — covered Phase 2 spec (#3 «emit save с очищенным payload»)
- composable `updateQuestion`/`removeQuestion` не меняют `state.step` — covered Phase 1 spec
- `delete /questions/:id` soft (фильтр `q.is_active` уже стоит) — saved delete reload показывает 0 карточек, цель сохраняется в БД
- edit/delete buttons `@click.stop` — кликал по иконкам, навигация на `questionReport` не происходила

Notes: live smoke выявил race-condition в `AlertDialog` confirm — reka-ui emit'ит `update:open(false)` ДО `@click` action-кнопки, parent's `@update:open` обнулял ref до запуска confirm-handler'а. Фикс через нерактивный `let pendingDelete*` snapshot — commit `1611102`. После фикса pending delete и saved delete оба корректны.

## Conclusion

Outcome: редактирование и удаление вопросов добавлено в `GoalView` (saved) и `GoalCreateView` (pending), head `b6763bb`.

Invariants:
- бот-scenes / Goal entity не модифицированы — `git diff --stat $BASE..HEAD -- alfy-bot/src/modules/bot/ alfy-bot/src/shared/entities/goal.entity.ts` → пусто
- step-flow компоненты (кроме `QuestionTypeStep`) не модифицированы — `git diff --stat` без QuestionTypeStep пусто
- `QuestionEditForm` очищает targetValue/selectedDays/intervalDays — Phase 2 spec, тест #3
- composable updateQuestion/removeQuestion — чистые операции, `state.step` не меняется (Phase 1 specs)
- delete saved — `AlertDialog` confirm + `DELETE /questions/:id` (soft) + reload — live verified
- delete pending — `AlertDialog` confirm + splice массива — live verified
- edit/delete buttons `@click.stop` в GoalView — клик по иконке не уходит на отчёт (live verified)

Review findings:
- Important: race-condition в AlertDialog confirm (`@update:open` обнуляет ref ДО `@click` action-кнопки) — fixed in `1611102` через нерактивный `let pendingDelete*` snapshot.
- Important: `v-model="draft.intervalDays"` на `type="text"` сохранял строку, ломал Save для кастомного интервала — fixed in `b6763bb` через `.number` модификатор.
