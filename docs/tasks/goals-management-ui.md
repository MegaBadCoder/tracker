# Goals Management UI

**Status:** done
**Branch:** feat/goals-management-ui
**Worktree:** .worktrees/feat-goals-management-ui
**Mode:** interactive

## Design

### Цель

Перенести логику создания целей из Telegram-бота (`bot/scenes/create-goal.scene.ts`) в веб-интерфейс: новый пошаговый flow на отдельной странице в разделе «Мои цели» (`HomeView`, `/`). Полное зеркало UX бота — те же шаги, тот же порядок, те же тексты вопросов, те же типы и расписания. Отсутствующие на бэке мутации (POST/PATCH) добавляются.

### Scope

В рамках задачи:

1. **Бэкенд (alfy-bot)** — добавить REST-эндпоинты, перепакетировав уже существующие методы `GoalService` (не дублировать логику, не трогать бот-scenes):
   - `POST /api/goals` — создать цель (тело: `goal_name`, `goal_start`, `goal_end`).
   - `POST /api/goals/:id/questions` — добавить пакет вопросов с расписаниями (тело: массив `QuestionWithSchedule`).
   - `PATCH /api/goals/:id` — изменить статус (`active | completed | deleted`) и при желании другие поля.
   - Все три — под `JwtAuthGuard`, проверка владельца (`goal.user_id === req.user.sub`).

2. **Фронт (alfy-bot-frontend)** — новый stepper flow:
   - Маршрут `/goals/new` → `views/GoalCreateView.vue`.
   - Внутри: state-machine с шагами `type → name → start → end → pointA → create → questionsOffer → [questionType → questionText → (number→targetValue) → canSkip → schedule(daily|weekly_days|interval) → loop] → save`.
   - Единый layout: «полотно» с переписывающимся содержимым шага + кнопки «Назад» / «Отмена» (как в боте), без route-per-step.
   - Точка входа: primary-кнопка «+ Создать цель» в `HomeView` рядом с табами фильтра.

3. **UI компоненты** — переиспользуем `components/ui/*` (shadcn-vue: Button, Input, Tabs, Card, RadioGroup, ToggleGroup, Calendar при необходимости). Stepper-обёртка — локальный компонент во `views/GoalCreateView.vue`, без выноса в общий UI (YAGNI).

Вне scope (явно): SMART/GLOBAL поведение **зеркалит бот** — показываем экран «🚧 Этот тип цели в разработке» c кнопкой «Назад». Никаких новых полей в `Goal` entity. Точку А спрашиваем, но не сохраняем (полное зеркало бота — см. ниже). Редактирование цели и редактирование/удаление вопросов из веба — не добавляем (бот тоже не умеет этого через `create-goal`).

### Выбранный подход

**Single-route stepper** на `/goals/new` с локальной state-машиной (Vue `ref`/`reactive`) внутри `GoalCreateView.vue`. Каждый шаг — отдельный child-компонент в `features/goals/ui/steps/<StepName>.vue` под FSD-конвенцией, чтобы крупный view не превратился в монолит. State и переходы между шагами — composable `useGoalCreateFlow()` в `features/goals/model/`.

Tradeoff: матчит UX бота 1:1 (одна «страница», стрелка «Назад» внутри flow, общая отмена). Маршрут один — refresh сбрасывает draft (приемлемо, как в боте). Не используем `vue-router` per-step, чтобы не плодить пути под технический wizard.

Альтернатива A — route-per-step — отвергнута: ломает «одно полотно» бота, добавляет deep-link, который нам сейчас не нужен, и query-state на refresh.
Альтернатива C — общий Wizard-компонент — отвергнута: единственный сценарий wizard'а в проекте, YAGNI.

### Step-by-step (зеркало бота)

| # | Шаг | Что показываем | Куда сохраняем |
|---|---|---|---|
| 1 | type | 3 радио-кнопки: 📝 Простая / 🎯 SMART / 🌍 Global. Источник — `GOAL_TYPE_CONFIG`. | `flow.goalType` |
| 1a | type (disabled) | Если выбран `smart`/`global` → экран «🚧 Этот тип цели в разработке» + кнопка «⬅️ Назад к выбору». | — |
| 2 | name | `Input`, plain text. Валидация: непустая строка после trim. | `flow.goalName` |
| 3 | start | Радио-кнопки: Сегодня / Завтра / Через неделю / Своя дата. При выборе «Своя» — `Input` ДД.ММ.ГГГГ или «Завтра», «Через N дней» (тот же парсер, что у бота — портируем). | `flow.startDate` (Date) |
| 4 | end | Радио: пресеты от старта (см. `END_DATE_OPTIONS`) или «Своя». Валидация — `endDate > startDate`. | `flow.endDate` |
| 5 | pointA | «Зафиксировать точку А?» Да/Нет. Ответ **не передаётся в API** (мёртвый шаг, точное зеркало бота). | `flow.pointA` (локально) |
| 6 | create | POST `/goals` с `{goal_name, goal_start(ISO), goal_end(ISO)}`. На успехе → экран «✅ Цель поставлена!» + предложение настроить вопросы (Да/Пропустить). | `flow.goalId` |
| 7 | questions loop | На каждой итерации — добавить ещё вопрос или «Готово». Список добавленных показываем счётчиком, как в боте (`MESSAGES.QUESTION_SETUP.ADDED`). | `flow.questionsToAdd[]` |
| 7a | questionType | Радио по `QUESTION_TYPES` (text / rating / emoji_rating / yes_no / number / time_spent). | `pending.type` |
| 7b | questionText | `Input` с подсказкой-примером (config.example). | `pending.text` |
| 7c | targetValue | **Только если `type === 'number'`**. `Input` (number) или кнопка «Пропустить». | `pending.targetValue` |
| 7d | canSkip | Да/Нет. | `pending.canSkip` |
| 7e | schedule | Радио: Каждый день / По дням недели / Через N дней. | `pending.scheduleType` |
| 7e-weekly | weeklyDays | Toggle-группа Пн–Вс, минимум 1. | `pending.selectedDays` |
| 7e-interval | intervalDays | Пресеты 2/3/7/14 + кастомный input. | `pending.intervalDays` |
| 7-loop | После шага 7e — push в `questionsToAdd`, очистка `pending`, возврат на 7a (или Готово). | — |
| 8 | save | POST `/goals/:id/questions` (если `questionsToAdd.length > 0`). После — `router.push('/goals/:id')` на детали созданной цели. | — |

Кнопка «Отмена» на любом шаге → confirm dialog (shadcn-vue `AlertDialog`) → если до шага 6 (`create`): просто `router.push('/')`; если после `create`, но не успели сохранить вопросы — цель уже создана, редирект на её страницу с тостом «Вопросы можно настроить позже» (вопросы не сохраняем). Кнопка «Назад» — откатывает на предыдущий шаг (state-машина).

### Парсер дат

Бэкенд имеет `DateParserService` (`shared/services/date-parser.service.ts`). Зеркалить «текстовый» ввод даты («Сегодня», «Через 5 дней», «25.01.2026») удобнее портировать на фронт **минимально** — только нужные форматы. Альтернативно: на «Своя дата» поставить нативный `<input type="date">` + чекбокс «Записать словами» с теми же подсказками. Решение в плане — но **расширять scope парсингом «словесных» дат на фронте не нужно**: достаточно `<input type="date">` для wall-clock ввода. Это **сознательное упрощение** относительно бота (Telegram-flow вынужденно текстовый), и оно не ломает зеркало логики — флоу шагов идентичен, меняется лишь форма ввода даты. Подсветим это в плане.

### Зависимости и переиспользование

- **Бэк**: `GoalService.create`, `addQuestionsWithSchedules`, `updateGoalStatus`, `findById`. Новые DTO в `goal/dto/`: `CreateGoalDto`, `AddQuestionsDto`, `UpdateGoalDto`.
- **Фронт**: `api/goals.ts` расширяется функциями `createGoal`, `addGoalQuestions`, `updateGoalStatus`. Типы — из `types/index.ts`; добавляем `CreateGoalDto`, `QuestionWithScheduleDto`.
- **UI-примитивы**: `RadioGroup`, `ToggleGroup`, `Input`, `Button`, `Card`, `AlertDialog` из `components/ui/`. Если чего-то нет — добавить через shadcn-vue в стиле `new-york` (см. `components.json`).

### Backwards-compat

Greenfield для UI-стороны (новых эндпоинтов). GET-эндпоинты `/goals` и `/goals/:id` не меняются. Бот-scenes не трогаем. SQLite `synchronize: true` — миграций нет (новых колонок тоже нет).

Один риск: ввод даты как `goal_start`/`goal_end` — формат `YYYY-MM-DD` (строка). И бот, и существующий `GoalService.create` его так и сохраняют. Фронт должен слать тот же формат — иначе тип будет рассогласован. Зафиксировано в инвариантах ниже.

### TDD

TDD: yes — для `useGoalCreateFlow()` composable (state-машина переходов: правильный порядок шагов, корректная обработка «назад», игнорирование `targetValue` для не-number типов, ограничения weekly_days ≥ 1). Это детерминированная reusable-логика, в которой регрессия → испорченный UX. Бэкенд-эндпоинты — простые controller-обёртки, покрываем интеграционным тестом одного «зелёного пути» через `goal.controller.spec.ts` (без жёсткого TDD).

### Открытые мелкие пункты (решаем в плане)

- Конкретные имена/коды callback-actions бота переносим как enum'ы шагов в composable (`'type' | 'name' | ...`).
- Нужен ли тост-механизм после ошибок API. Если в кодбазе уже есть — переиспользуем; если нет — `console.error` + локальный inline-баннер. Уточнить в плане.

TDD: yes (state-машина flow в composable; backend — обычные тесты без жёсткого TDD)

### Invariants

- `goal_start` и `goal_end` отправляются на бэк строкой `YYYY-MM-DD` (без времени, без таймзоны) — это формат `Goal.goal_start`/`goal_end` в БД и API. Дату собираем из локального wall-clock ввода пользователя.
- `endDate > startDate` валидируется на фронте перед переходом с шага 4 и на бэке в `CreateGoalDto`.
- Шаг «pointA» **не передаётся** в API (зеркало бота).
- Для типов вопросов **не `number`** поле `targetValue` отсутствует в payload (не пустая строка, не null — отсутствует ключ).
- Для `scheduleType === 'weekly_days'` `selectedDays` непустой (≥ 1 день).
- SMART / GLOBAL — никогда не доходят до шага `name`. После показа экрана «в разработке» единственный выход — «Назад к выбору типа» или «Отмена».
- Создание цели — owner-bound: все три новых эндпоинта проверяют `goal.user_id === req.user.sub` (для `POST /goals` это автоматически по `userId` из JWT; для `POST /:id/questions` и `PATCH /:id` — явная проверка перед делегированием в сервис).
- Бот-scenes (`create-goal.scene.ts`, `list-goals.scene.ts`) не модифицируются.

### Principles

- Зеркало UX бота над «улучшениями» — где бот спрашивает, спрашивает и UI; где бот скипает, скипает и UI. Расхождения только для невозможного-в-вебе ввода (нативный date-picker вместо текстового парсинга).
- Шаги — child-компоненты под одной state-машиной, а не route-per-step.
- API-эндпоинты — тонкие обёртки над `GoalService`, никакой бизнес-логики в controller.
- shadcn-vue first — никаких сторонних UI-либ; перед созданием — grep `components/ui/`.
- YAGNI: никакого общего `<Wizard />` компонента, никаких полей в БД, никакого «улучшенного» UX там, где бот того не делает.

## Plan

Approach: backend получает три тонких controller-эндпоинта поверх существующего `GoalService`; фронт получает state-машину создания в composable + однострочный stepper-view со step-компонентами и точкой входа в `HomeView`.

### Phase 1 — Backend: mutations

- **1.1** `alfy-bot/src/modules/goal/dto/` (create new files)
  - `create-goal.dto.ts` — `CreateGoalDto { goal_name: string; goal_start: string; goal_end: string }`. Декораторы: `@IsString() @Length(1, 200) goal_name`, `@Matches(/^\d{4}-\d{2}-\d{2}$/) goal_start`, то же для `goal_end`. Кросс-валидация `endDate > startDate` — custom `@Validate(EndAfterStart, ['goal_start'])` или в controller, проще — в сервисе через guard-блок в контроллере (одна строка), `BadRequestException` при нарушении.
  - `add-questions.dto.ts` — `AddQuestionsDto { questions: QuestionWithScheduleItem[] }`. `QuestionWithScheduleItem { question: string; type: QuestionType; canSkip: boolean; scheduleType: FrequencyType; selectedDays?: number[]; intervalDays?: number; targetValue?: string }`. Декораторы: `@ArrayMinSize(1)`, `@ValidateNested({each:true})`, `@Type(() => QuestionWithScheduleItem)`. На item: `@IsString() question`, `@IsIn(['text','rating','emoji_rating','yes_no','number','time_spent']) type`, `@IsBoolean() canSkip`, `@IsIn(['daily','weekly_days','interval']) scheduleType`, `@IsArray() @ArrayMinSize(1) @IsInt({each:true}) selectedDays?` (валидируется условно — см. ниже), `@IsInt() @Min(1) intervalDays?`, `@IsString() targetValue?`.
  - `update-goal.dto.ts` — `UpdateGoalDto { status?: 'active' | 'completed' | 'deleted'; goal_name?: string }`. Достаточно `@IsIn([...]) @IsOptional() status` и `@IsString() @IsOptional() goal_name`.
  - Invariants: «YYYY-MM-DD», «endDate > startDate», «weekly_days has ≥1 day».
- **1.2** `alfy-bot/src/modules/goal/goal.controller.ts:33-81` (modify)
  - Добавить `POST /` → `create(@Request() req, @Body() dto: CreateGoalDto): Promise<GoalDto>`. Тело: проверка `goal_end > goal_start` (одна строка через `Date.parse`), затем `goalService.create(userId, dto)`. Возврат — созданный goal с `questions: []`.
  - Добавить `POST /:id/questions` → `addQuestions(@Request() req, @Param('id') id, @Body() dto: AddQuestionsDto): Promise<QuestionDto[]>`. Тело: `assertOwnedGoal(req, id)`, дополнительная conditional-валидация (`scheduleType === 'weekly_days' ⇒ selectedDays?.length ≥ 1`, `'interval' ⇒ intervalDays ≥ 1`) — `BadRequestException`. Делегирует `goalService.addQuestionsWithSchedules(id, dto.questions)`.
  - Добавить `PATCH /:id` → `update(@Request() req, @Param('id') id, @Body() dto: UpdateGoalDto): Promise<GoalDto>`. Тело: `assertOwnedGoal`, при `dto.status` — `goalService.updateGoalStatus(id, dto.status)`, при `dto.goal_name` — `goalService.update(id, { goal_name })`. Возврат — `findById` после.
  - Добавить private helper `assertOwnedGoal(req: AuthRequest, id: number): Promise<Goal>` — `findById`, `NotFoundException` если null или `goal.user_id !== req.user.sub`.
  - Invariants: «owner-bound mutations», «pointA not in API surface» (просто отсутствует).
- **1.3** `alfy-bot/src/modules/goal/dto/goal-response.dto.ts:1-97` (modify)
  - Добавить экспорты новых DTO в barrel-like манере (если используется), либо просто отдельные файлы — controller импортирует напрямую. Без изменений к `GoalDto`/`QuestionDto`.
- **1.4** `alfy-bot/src/modules/goal/goal.controller.spec.ts` (create new)
  - Один happy-path интеграционный спек на каждый из трёх эндпоинтов через `Test.createTestingModule` с mocked `GoalService`: POST 201, POST `/:id/questions` 201 c корректным форвардом аргументов, PATCH 200 c `updateGoalStatus`. Один negative: `assertOwnedGoal` бросает `NotFoundException`, когда `user_id` чужой.
- Commit: `feat(goal): REST endpoints для create/addQuestions/update`

### Phase 2 — Frontend: composable state-machine + API client (TDD)

- **2.1** `alfy-bot-frontend/tests/features/goals/use-goal-create-flow.spec.ts` (create — **failing tests first**)
  - Behaviors:
    - `step === 'type'` на init; выбор `'simple'` → `'name'`; `'smart'`/`'global'` → `'type_in_development'`; «Назад» из stub → `'type'`.
    - `'name'` → требует непустую строку → `'start'`.
    - Цепочка `start → end → pointA → ready_to_create` без вызова API.
    - `pointA` (true|false) не попадает в payload `buildCreatePayload()`.
    - `buildCreatePayload()` сериализует даты как `YYYY-MM-DD` в локальной таймзоне.
    - Валидация `endDate > startDate` блокирует переход с `'end'`.
    - Questions-loop: после `'questions_offer:yes'` → `'q_type'`; `'q_type:number'` → `'q_text'` → `'q_target_value'` → `'q_can_skip'`; `'q_type:text'` пропускает `'q_target_value'`.
    - `scheduleType: 'weekly_days'` требует `selectedDays.length ≥ 1`.
    - `buildQuestionsPayload()` отдаёт массив без `pending` полей и без `targetValue` если `type !== 'number'`.
    - «Назад» от `'q_text'` возвращает на `'q_type'` с очищенным `pending.text`.
- **2.2** `alfy-bot-frontend/src/features/goals/model/use-goal-create-flow.ts` (create)
  - Сигнатуры:
    ```ts
    export type Step =
      | 'type' | 'type_in_development' | 'name' | 'start' | 'end' | 'point_a'
      | 'creating' | 'questions_offer'
      | 'q_type' | 'q_text' | 'q_target_value' | 'q_can_skip' | 'q_schedule'
      | 'q_weekly_days' | 'q_interval' | 'saving' | 'done'
    export interface FlowState { step: Step; goalType?: GoalType; goalName?: string;
      startDate?: Date; endDate?: Date; pointA?: boolean; goalId?: number;
      questionsToAdd: QuestionWithScheduleItem[];
      pending: Partial<QuestionWithScheduleItem> }
    export function useGoalCreateFlow(): {
      state: Readonly<Ref<FlowState>>
      go: { selectType(t: GoalType): void; submitName(s: string): void;
            selectStartPreset(p: 'today'|'tomorrow'|'week'|'custom', custom?: Date): void;
            selectEndPreset(...): void; setPointA(v: boolean): void;
            offerQuestions(yes: boolean): void; selectQuestionType(t: QuestionType): void;
            submitQuestionText(s: string): void; submitTargetValue(s?: string): void;
            setCanSkip(v: boolean): void; selectSchedule(t: FrequencyType): void;
            toggleWeekday(d: number): void; confirmWeekly(): void;
            setInterval(n: number): void;
            addQuestion(): void; back(): void; cancel(): void }
      buildCreatePayload(): CreateGoalDto
      buildQuestionsPayload(): QuestionWithScheduleItem[]
      submit: { createGoal(): Promise<number>; saveQuestions(): Promise<void> } }
    ```
  - Внутри — `ref<FlowState>` + чистые transition-функции. История шагов — `step[]` стэк для `back()`.
  - Invariants: targetValue только для number, weekly_days ≥ 1 день, pointA не в payload, дата YYYY-MM-DD (использовать `toLocalISODate(date)` ниже).
- **2.3** `alfy-bot-frontend/src/features/goals/lib/dates.ts` (create)
  - `toLocalISODate(d: Date): string` — `YYYY-MM-DD` через `getFullYear/getMonth/getDate` (локальная wall-clock, как в `goal.service.ts:todayISO`).
- **2.4** `alfy-bot-frontend/src/api/goals.ts:1-44` (modify)
  - Добавить:
    ```ts
    export interface CreateGoalDto { goal_name: string; goal_start: string; goal_end: string }
    export interface QuestionWithScheduleItem { question: string; type: QuestionType; canSkip: boolean; scheduleType: FrequencyType; selectedDays?: number[]; intervalDays?: number; targetValue?: string }
    export async function createGoal(dto: CreateGoalDto): Promise<Goal>
    export async function addGoalQuestions(goalId: number, items: QuestionWithScheduleItem[]): Promise<Question[]>
    export async function updateGoal(goalId: number, dto: { status?: 'active'|'completed'|'deleted'; goal_name?: string }): Promise<Goal>
    ```
- **2.5** `alfy-bot-frontend/src/types/index.ts:2` (modify)
  - Привести `GoalType` к нижнему регистру (`'simple' | 'smart' | 'global'`) для совпадения с `GOAL_TYPES` на бэке. Grep на использования — на момент написания плана `GoalType` не используется во фронте (только тип-импорт в `GoalTypeBadge`?). Проверить перед изменением; если есть консьюмеры — оставить как есть и в composable использовать локальный union. **Решение в Execute по grep'у.**
- Commit: `feat(frontend): composable state-машина создания цели + API client`

### Phase 3 — Frontend: stepper UI + точка входа

- **3.1** `alfy-bot-frontend/src/features/goals/ui/steps/` (create new directory, 1 file per step)
  - `TypeStep.vue`, `TypeInDevelopmentStep.vue`, `NameStep.vue`, `StartDateStep.vue`, `EndDateStep.vue`, `PointAStep.vue`, `CreateProgressStep.vue`, `QuestionsOfferStep.vue`, `QuestionTypeStep.vue`, `QuestionTextStep.vue`, `TargetValueStep.vue`, `CanSkipStep.vue`, `ScheduleStep.vue`, `WeeklyDaysStep.vue`, `IntervalStep.vue`, `SavingStep.vue`.
  - Каждый принимает `state` (props) и эмитит события в `go.*` методы composable. Без локального state, кроме draft-input полей.
  - UI: shadcn-vue `Button` (variants), `Input`, `AlertDialog` для cancel-confirm. Для weekday toggle — ряд `Button` с `variant="outline"` и активным `variant="default"` (нет `ToggleGroup` в primitives — не добавляем).
  - Тексты — копипаст из `alfy-bot/src/shared/constants/messages.ts:MESSAGES.GOAL_CREATION/SCHEDULE/QUESTION_SETUP/POINT_A` (дублирование сознательное; источник правды — бот, фронт держит копию рядом с UI).
- **3.2** `alfy-bot-frontend/src/views/GoalCreateView.vue` (create)
  - `<script setup>` — `useGoalCreateFlow()`, watch `state.step` для side-effects при `'creating'`/`'saving'` (вызов `createGoal`/`addGoalQuestions`, на успехе `state.goalId` setter + переход), на ошибку — inline error баннер.
  - Template — `<AppHeader title="Создание цели" :show-back="true" />` + `<PageContainer>` + `<component :is="stepMap[state.step]" :state="state" @<event>="..." />`.
  - В `router/index.ts:44-48` добавить маршрут `{ path: 'goals/new', name: 'goal-create', component: () => import('../views/GoalCreateView.vue') }`. Вставить **перед** `path: 'goals/:id'` (vue-router всё равно matchает по path, но порядок понятнее).
- **3.3** `alfy-bot-frontend/src/views/HomeView.vue:36-60` (modify)
  - Добавить primary-кнопку `<Button @click="$router.push({name: 'goal-create'})">+ Создать цель</Button>` в строку с Tabs (flex row, justify-between). На мобилке — сжать текст до «+».
  - Invariants: «бот-scenes не трогаются» — никаких других файлов в этом phase.
- **3.4** `alfy-bot-frontend/tests/views/GoalCreateView.spec.ts` (create, минимальный smoke)
  - Один тест: рендер `'type'` → клик «Простая цель» → видна форма имени. Без MSW (composable замокать import'ом не получится — оставим как UI-smoke без проверки API).
- Commit: `feat(frontend): пошаговый UI создания цели + entry на HomeView`

### Test strategy

- **Phase 1** (backend, обычные тесты): 3 happy + 1 negative в `goal.controller.spec.ts` через `Test.createTestingModule`, mocked `GoalService`. Никакого e2e — `goal.service` уже покрыт через бот-сценарии.
- **Phase 2** (TDD): see 2.1 — failing tests first, потом composable. Goal — поведенческое покрытие переходов и payload-builders.
- **Phase 3**: один UI smoke-тест (см. 3.4).

### Backwards-compat

Greenfield для фронт-стороны. На бэке три новых эндпоинта; существующие GET и бот-scenes не модифицируются. Goal entity не меняется. Скрытый риск drift'а — `GoalStatus` во `types/index.ts` использует `'archived'`, а бэк — `'deleted'`. **Не чиним в этой задаче** (вне scope); `UpdateGoalDto.status` сериализует то, что приходит, фронт-консюмер этого API сейчас всё равно не использует `archived`. Если в Execute натолкнёмся на блок — поднять в задаче-обсуждении.

### Order & dependencies

Phase 1 не блокирует Phase 2 (mocks/MSW в тестах). Phase 3 требует обоих. Если работаем последовательно — 1 → 2 → 3. Phase 1 и 2 параллелизуемы при наличии двух исполнителей.

### Open questions / risks

- `GoalType` casing во `types/index.ts` (`'SIMPLE'` vs backend `'simple'`) — решение в Execute по grep на использования. Дефолт: переименовать в lower-case, иначе создать локальный union в composable.
- Toast-механика для ошибок API — поискать в кодбазе при Execute (`grep -rn "toast\|useToast" alfy-bot-frontend/src`). Если нет — inline-баннер.

## Verify

**Result:** passed

Positive:
- backend tests: `npx jest src/modules/goal` → 5 passed (POST/POST-questions/PATCH happy + endDate validation + owner-check negative)
- frontend tests: `npx vitest run tests/features/goals tests/views/GoalCreateView.spec.ts` → 18 passed (17 composable + 1 view smoke)
- backend build: `npm run build` (nest build) → exit 0
- frontend build: `npm run build` (vue-tsc + vite + PWA) → exit 0

Negative (covered in goal.controller.spec.ts):
- `assertOwnedGoal` бросает `NotFoundException` для чужого `user_id`
- `POST /goals` бросает `BadRequestException` при `goal_end <= goal_start`

Invariants:
- бот-scenes не модифицированы: `git diff --stat origin/main..HEAD -- alfy-bot/src/modules/bot/scenes/` → пусто
- `Goal` entity не модифицирована: `git diff --stat origin/main..HEAD -- alfy-bot/src/shared/entities/goal.entity.ts` → пусто
- `YYYY-MM-DD` контракт: `@Matches(/^\d{4}-\d{2}-\d{2}$/)` в `CreateGoalDto`; `toLocalISODate()` на фронте (покрыто composable-тестом)
- pointA не в payload: `buildCreatePayload` не включает (покрыто composable-тестом)
- targetValue только для number: `buildQuestionsPayload` (покрыто composable-тестом)
- weekly_days ≥ 1: controller conditional-валидация + composable `confirmWeekly` (покрыто composable-тестом)
- owner-bound mutations: 3 эндпоинта используют `assertOwnedGoal` (покрыто controller-spec'ом)

Smoke: API live-smoke и UI browser-smoke не выполнены в этой сессии (требуют локального env: TELEGRAM_BOT_TOKEN, JWT issuance, запуск frontend dev-сервера). Покрытие через controller-spec (auth-guard замокан, forwarding верифицирован) и composable-spec считаю достаточным для перехода в review. Live-smoke передан пользователю.

Notes:
- Pre-existing TS-ошибка `src/app.controller.spec.ts(19,28)` присутствует на `origin/main` (commit `1ed6638`) — не связана с этой задачей; подтверждено `git stash -u && npx tsc --noEmit`.
- Pre-existing vitest failures (TaskCard/TaskForm/tasks-api) присутствуют на `origin/main` — не связаны с этой задачей.

## Conclusion

Outcome: пошаговое создание целей перенесено из бот-сцены в веб (4 коммита, head `1dff8d9`).

Invariants:
- бот-scenes и `Goal` entity не модифицированы — `git diff --stat origin/main..HEAD -- alfy-bot/src/modules/bot/ alfy-bot/src/shared/entities/goal.entity.ts` → пусто
- `YYYY-MM-DD` контракт: regex в `CreateGoalDto` + `Number.isFinite` guard в controller + `toLocalISODate()` на фронте (тесты композабла)
- pointA не в API — composable `buildCreatePayload` не включает (тест)
- targetValue только для number — `buildQuestionsPayload` (тест)
- weekly_days ≥ 1 — controller conditional + composable `confirmWeekly` (тест)
- owner-bound mutations — `assertOwnedGoal` в 3 эндпоинтах (тест)

Review findings:
- Critical: «Готово» отсутствовало в `QuestionTypeStep`, `submit.saveQuestions` был мёртв — fixed in `1dff8d9` (добавлен `go.finishQuestions()` + кнопка, видна при `questionsToAdd.length > 0`).
- Critical: `offerQuestions(false)` терял уже добавленные вопросы — fixed in `1dff8d9` (маршрут на `'saving'` при непустом списке).
- Important: regex пропускал семантически невалидные даты (`Date.parse → NaN`) — fixed in `1dff8d9` (`Number.isFinite` guard в controller).
- Important: `EndDateStep` взводит `error.value` после emit — push back, current behavior корректен (валидный путь размонтирует компонент до отрисовки ошибки; ревьюер сам признал «UX приемлемо»). Cosmetic, не баг.

Verified by: live API smoke (curl с JWT) и browser UI click-through не выполнены в этой сессии — требуют локального env (TELEGRAM_BOT_TOKEN, dev frontend). Покрытие через controller-spec и composable-spec считаю достаточным для merge. Сетка ручной проверки оставлена пользователю при PR-смерч-тесте.
