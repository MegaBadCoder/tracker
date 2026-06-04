# Add Question to Goal (web)

**Status:** done
**Branch:** feat/web-goal-reports
**Worktree:** .worktrees/feat-web-goal-reports
**Mode:** interactive

## Design

Size: **Small** (Design-стадия пропущена; сводка решений ниже).

### Цель
Дать возможность добавлять новые вопросы к УЖЕ созданной цели из веба (страница цели `GoalView.vue`).

### Текущее состояние (проверено в коде)
- **Бэкенд готов:** `POST /goals/:id/questions` (`goal.controller.ts:116-151`, `AddQuestionsDto`) → `goalService.addQuestionsWithSchedules` создаёт вопросы + расписания, `order_index` ведётся репозиторием. Ничего на бэке не добавляем.
- **API-клиент готов:** `addGoalQuestions(goalId, items: QuestionWithScheduleItem[])` (`api/goals.ts:84-92`).
- **Форма готова к реюзу:** `QuestionEditForm.vue` принимает `initial: QuestionWithScheduleItem`, эмитит `save(value)`/`cancel`, валидация и сборка payload внутри — нет логики, завязанной строго на редактирование. Подходит для создания с пустым `initial`.
- **Дыра:** в `GoalView.vue` нет кнопки/входа «Добавить вопрос». Редактирование уже открывается в `Sheet` (`GoalView.vue:474-491`).

### Подход (выбран пользователем)
Кнопка «+ Добавить вопрос» в секции вопросов `GoalView` открывает **Sheet** (тот же паттерн, что редактирование) с переиспользованным `QuestionEditForm`, инициализированным дефолтным пустым вопросом. На `save` → `addGoalQuestions(id, [value])` → `reloadGoal()` + закрыть Sheet. Ошибку показываем, Sheet не закрываем.

### Out of scope
- Бот: добавление вопроса к существующей цели в Telegram (там только при создании) — отдельная задача.
- Пошаговый мастер добавления (выбран Sheet, не wizard).
- Изменение бэкенда/эндпоинтов.

### Invariants
- Запись нового вопроса — только через существующий `POST /goals/:id/questions` (реюз `addGoalQuestions`); новых эндпоинтов не вводим.
- Форма создания и редактирования — один компонент `QuestionEditForm` (не дублировать форму).
- Опции типов/расписаний берутся из единого конфига (`question-types.ts`/`goal-create-options.ts`), не хардкодятся.
- После успешного добавления список вопросов цели перезагружается (`reloadGoal`), чтобы новый вопрос появился с корректным `order_index` с бэка.

### Principles
- Реюз поверх дублирования: тот же Sheet-паттерн и та же форма, что у редактирования.
- Fail fast: ошибку сохранения показываем в форме, Sheet не закрываем, список не трогаем.
- FSD: форма в `features/goals/ui`, страница в `views/`; примитивы — shadcn-vue, без новых зависимостей.

TDD: yes (компонентный тест: открытие Sheet, сабмит формы вызывает `addGoalQuestions` с верным payload и перезагружает; ошибка — Sheet остаётся).

## Plan

Approach: одна фаза. Реюз `QuestionEditForm` + новый Sheet «Добавить вопрос» в `GoalView`, зеркало существующего Sheet редактирования. Запись через готовый `addGoalQuestions`. Дефолт нового вопроса — чистая функция (тестируемо).

### Phase 1 — Add-question Sheet в GoalView

- **1.1** `alfy-bot-frontend/src/features/goals/lib/new-question.ts` (create)
  - `newQuestionDraft(): QuestionWithScheduleItem` → дефолт: `{ question: '', type: 'text', canSkip: false, scheduleType: 'daily' }`. Чистая функция (новый объект на вызов — не шарить ссылку между открытиями Sheet).
  - Invariant: опции/дефолты согласованы с конфигом; форма сама подтянет лейблы из `question-types.ts`.
- **1.2** `alfy-bot-frontend/src/views/GoalView.vue` (modify)
  - script: импорт `Plus` (lucide), `addGoalQuestions` (из `../api/goals`), `newQuestionDraft`.
  - state: `addingQuestion = ref(false)`, `addError = ref<string|null>(null)`, реюз `saving` ref (или отдельный `adding` — использовать существующий `saving`, он уже общий для form-сабмитов).
  - `async function onSaveAdd(value: QuestionWithScheduleItem)`: `saving=true; addError=null; try { await addGoalQuestions(id, [value]); await reloadGoal(); addingQuestion.value=false } catch(e) { addError = msg } finally { saving=false }`. Fail-fast: на ошибке Sheet не закрываем, список не трогаем.
  - template секция «Вопросы цели» (`GoalView.vue:420-424`): в `flex justify-between` рядом с `<h2>` — кнопка `<Button size="sm" variant="outline" data-testid="add-question-cta" @click="addingQuestion = true"><Plus/> Добавить вопрос</Button>`.
  - template: новый `<Sheet>` (после edit-Sheet, ~491) зеркало edit-Sheet: `:open="addingQuestion"`, `@update:open` сбрасывает `addingQuestion`+`addError`; `<SheetTitle>Добавить вопрос</SheetTitle>`; `<QuestionEditForm :initial="newQuestionDraft()" submit-label="Добавить" :error="addError ?? undefined" :submitting="saving" @save="onSaveAdd" @cancel="addingQuestion=false; addError=null">`.
  - Invariants: запись только через `addGoalQuestions` (POST /goals/:id/questions); форма — тот же `QuestionEditForm`; `reloadGoal` после успеха → новый вопрос с бэковым `order_index`.
- Commit: `feat(goals): add-question sheet on goal page`

### Test strategy (TDD: yes)

Написать до реализации:
- `tests/features/goals/new-question.spec.ts` (create) — `newQuestionDraft()` возвращает дефолт `{question:'', type:'text', canSkip:false, scheduleType:'daily'}`; два вызова → разные объекты (не shared ref).
- `tests/views/GoalView.spec.ts` (create) — mount `GoalView` с `vi.mock('@/api/goals')` (как `tests/views/HomeView.spec.ts`: мок `fetchGoalById` отдаёт цель с вопросами, `addGoalQuestions` мок; `vi.mock('@/api/reports')` для `fetchGoalReportStatus`; `vi.mock('vue-router')`):
  - клик `add-question-cta` открывает Sheet (рендерит `QuestionEditForm`);
  - `save` формы (через эмит/заполнение текста + сабмит) вызывает `addGoalQuestions(id, [payload])` и затем `fetchGoalById` (reloadGoal);
  - ошибка `addGoalQuestions` (reject) → Sheet остаётся, `fetchGoalById` не вызывается повторно.
  - Если полный mount GoalView окажется хрупким (reka-ui Sheet teleport) — свести к проверке `onSaveAdd`-поведения через узкий тест или стаб Sheet; решить в Execute, не раздувать.

### Backwards-compat
Greenfield-добавление: новый Sheet/кнопка/файл, реюз существующего эндпоинта и формы. Существующее редактирование/удаление не трогаем. `saving` ref шарится edit+add — оба модальны и взаимоисключающи (нельзя открыть оба Sheet разом), гонок нет.

### Open questions / risks
- Полный mount `GoalView` в vitest может конфликтовать с teleport Sheet (reka-ui) — фоллбэк в Test strategy. Не блокер.

## Verify

**Result:** passed

Positive:
- `newQuestionDraft` дефолт + не-shared ref — 2/2
- GoalView: кнопка открывает Sheet, save → `addGoalQuestions(5, [payload])` + повторный `fetchGoalById` (reload) — 2/2
- Live: `POST /api/goals/16/questions` → 201; вопрос создан (новый id, `order_index 1` после существующего 0, расписание `daily`)

Negative:
- Ошибка `addGoalQuestions` → Sheet остаётся, `fetchGoalById` повторно не зовётся, ошибка в форме (unit)
- Live owner-check: чужой юзер (sub:8) POST к цели 16 → 404

Invariants:
- Запись только через `addGoalQuestions` (1 вызов в GoalView, нет `api.post`/`createQuestion`)
- Одна форма — реюз `QuestionEditForm` (нет дублирующего create-form)
- `reloadGoal()` после успеха; на ошибке список не трогаем

Smoke: `POST /api/goals/16/questions {text,daily}` → 201, вопрос с order_index 1 + schedule daily — end-to-end OK (тестовый вопрос удалён из БД-копии).

## Conclusion

Outcome: на странице цели появилась кнопка «Добавить вопрос» → Sheet с реюзом `QuestionEditForm`; запись через готовый `addGoalQuestions`. HEAD: `f283ca2`.

Invariants:
- Запись только через `addGoalQuestions` (POST /goals/:id/questions) — `GoalView.vue:156`, нет прямых `api.post`/новых эндпоинтов; live-проверка 201
- Одна форма create+edit — реюз `QuestionEditForm` (нет дублирующего create-form)
- Опции/лейблы из конфига — `newQuestionDraft` хранит только дефолт-значения, лейблы тянет форма
- `reloadGoal()` после успеха; на ошибке Sheet остаётся, список не трогаем (fail-fast, покрыто тестом)

Review findings: чисто — независимый `up:reviewer` находок ≥80 не нашёл; ключевое утверждение (нет потери введённых данных при ре-рендере, т.к. `QuestionEditForm` копирует initial в setup без watch) перепроверено диспетчером.

Verified by: live `POST /api/goals/16/questions` → 201 (вопрос с order_index 1 + schedule daily) + owner-check 404 против запущенного бэка на копии БД.

### Hands-off decisions
<empty — populated only when Mode is hands-off>

### Deferred (needs user input)
<empty — populated only when Mode is hands-off and a choice had no conservative default>
