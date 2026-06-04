# Question Types from Backend (single source of truth)

**Status:** done
**Branch:** feat/question-types-from-backend
**Worktree:** .worktrees/question-types-from-backend
**Mode:** interactive

## Design

Size: **Medium** (Design-стадия свёрнута; развилки разрешены с пользователем).

### Цель
Фронт не должен держать собственную копию `QUESTION_TYPE_OPTIONS`. Типы вопросов (label, example, options) приходят с бэка как единый источник истины — те же данные, что читает Telegram-бот. Расхождения между ботом и вебом исключаются физически.

### Текущее состояние (проверено в коде, base = origin/main e89d6c8)
- **Источник истины:** `alfy-bot/src/shared/types/question-types.ts` → `QUESTION_TYPES: Record<QuestionType, {type,label,description,example,options?,ui_component}>`. Бот читает его прямым импортом.
- **Фронт дублирует:** `alfy-bot-frontend/src/features/goals/ui/steps/question-types.ts` → хардкод `QUESTION_TYPE_OPTIONS` (зеркало, label/example/options).
- **7 потребителей** на фронте:
  - iterate в шаблоне: `QuestionTypeStep.vue`, `QuestionEditForm.vue`, `QuestionTextStep.vue` (через `findQuestionTypeOption`)
  - синхронное чтение `.options` на setup-top: `RatingAnswerInput`, `EmojiRatingAnswerInput`, `YesNoAnswerInput`, `TimeSpentAnswerInput`
- **Нет** HTTP-эндпоинта, отдающего `QUESTION_TYPES` для веба.

### Подход
**Backend:** новый узкий read-эндпоинт `GET /api/question-types` отдаёт `QUESTION_TYPES` как массив DTO (порядок сохранён). Отдельный `@Controller('question-types')` — НЕ в `questions`, иначе `GET questions/types` перехватится `GET questions/:id` (известный route-collision, см. CLAUDE.md).

**Frontend:** Pinia-стор грузит типы один раз при старте (после `authorize()` в `main.ts`) и кэширует. Хардкод `QUESTION_TYPE_OPTIONS` удаляется. 7 потребителей переводятся на стор: iterate → `store.all`; синхронные `.options` в answer-inputs → `computed(() => store.options(type))` (реактивно дождутся гидрации).

`answer-format.ts` НЕ трогаем — это логика маппинга (emoji_rating→индекс, yes_no→yes/no), не данные.

### Out of scope
- `goal-create-options.ts` (пресеты дат/интервала/дни недели) — зеркалят константы бота (`date-options.ts`/`messages.ts`), не общий shared. Отдельная задача.
- Изменение самой константы `QUESTION_TYPES` на бэке.
- Бот (уже читает источник напрямую).

### Invariants
- Единственный источник истины типов вопросов — бэковый `QUESTION_TYPES`; фронт его не дублирует (хардкод-массив удалён).
- `GET /question-types` отдаёт `QUESTION_TYPES` без потери/переупорядочивания элементов и поля `options`.
- Эндпоинт на отдельном контроллере/префиксе — не коллидирует с `questions/:id`.
- answer-format-логика (индекс/yes-no) остаётся на фронте, не уезжает на бэк.
- answer-inputs корректно работают до гидрации стора (пустой options → дорисовка после загрузки), без краша.

### Principles
- Источник данных — бэк; фронт только потребляет и кэширует.
- Реюз: стор грузит один раз (идемпотентный `load()`), компоненты читают реактивно.
- Fail fast: ошибку загрузки типов не глотаем молча в стор как «пустой массив навсегда» — логируем/позволяем повторить; но не роняем приложение на старте.
- FSD: api в `src/api/`, стор в `src/stores/`, без новых зависимостей (Pinia уже есть).

TDD: yes (бэк: контроллер отдаёт все типы с options; фронт: стор `load` идемпотентен/кэширует, геттеры `options`/`label`; answer-input рендерит из стора).

## Plan

Approach: 3 фазы. Бэк-эндпоинт → фронт-стор+api → перепроводка потребителей. Каждая — отдельный коммит.

### Phase 1 — Backend: GET /question-types

- **1.1** `alfy-bot/src/modules/question/dto/question-type.dto.ts` (create) — `QuestionTypeDto { type, label, example, options?: (string|number)[] }`, Swagger-декораторы.
- **1.2** `alfy-bot/src/modules/question/question-types.controller.ts` (create) — `@Controller('question-types')`, `JwtOrApiTokenGuard`, `@ApiBearerAuth()`. `@Get()` → `Object.values(QUESTION_TYPES).map(c => ({ type, label, example, options }))`. Импорт `QUESTION_TYPES` из `shared/types/question-types`.
- **1.3** `alfy-bot/src/modules/question/question.module.ts` (modify) — добавить `QuestionTypesController` в `controllers`.
- **1.4** `alfy-bot/src/modules/question/question-types.controller.spec.ts` (create) — отдаёт все 7 типов, порядок как в `QUESTION_TYPES`, options присутствует у rating/emoji_rating/yes_no/time_spent.
- Invariant: отдельный префикс (нет коллизии с `questions/:id`); отдаёт `QUESTION_TYPES` без потерь.
- Commit: `feat(questions): GET /question-types endpoint (single source of truth)`

### Phase 2 — Frontend: api + Pinia store

- **2.1** `alfy-bot-frontend/src/api/question-types.ts` (create) — `interface QuestionTypeOption { type: QuestionType; label: string; example: string; options?: (string|number)[] }`; `fetchQuestionTypes(): Promise<QuestionTypeOption[]>` → `GET /question-types`.
- **2.2** `alfy-bot-frontend/src/stores/question-types-store.ts` (create) — Pinia setup-store:
  - state `types = ref<QuestionTypeOption[]>([])`, `loaded = ref(false)`
  - `async load()` — идемпотентно: если `loaded` → return; иначе `fetchQuestionTypes()` → `types`, `loaded=true`. Ошибку пробрасываем (не глотаем в пустой массив).
  - getters: `all = computed(() => types.value)`; `byType(t): QuestionTypeOption|undefined`; `options(t): (string|number)[]` (→ `byType(t)?.options ?? []`); `label(t): string` (→ `byType(t)?.label ?? t`).
- **2.3** `alfy-bot-frontend/src/main.ts` (modify) — после успешного `authorize()` вызвать `useQuestionTypesStore().load()` (не блокировать рендер: можно `.catch` с логом — типы догрузятся, но fail не должен валить старт).
- **2.4** `tests/stores/question-types-store.spec.ts` (create) — `load` идемпотентен (2 вызова → 1 fetch); `options('emoji_rating')` = эмодзи-массив; `label('text')` корректен; до load `options` = `[]`.
- Commit: `feat(goals): question-types store fed from backend`

### Phase 3 — Frontend: перепроводка потребителей, удаление хардкода

- **3.1** answer-inputs (modify) — `RatingAnswerInput`, `EmojiRatingAnswerInput`, `YesNoAnswerInput`, `TimeSpentAnswerInput`: заменить `findQuestionTypeOption(t).options` на `computed(() => store.options(t))`; шаблон итерирует по computed. Реактивно дождётся гидрации.
- **3.2** `QuestionTypeStep.vue`, `QuestionEditForm.vue` (modify) — `QUESTION_TYPE_OPTIONS` → `store.all`; `typeLabel` → `store.label`.
- **3.3** `QuestionTextStep.vue` (modify) — `findQuestionTypeOption(type)` → `store.byType(type)`.
- **3.4** `alfy-bot-frontend/src/features/goals/ui/steps/question-types.ts` (modify/delete) — удалить хардкод `QUESTION_TYPE_OPTIONS`. Оставить только `interface`/тип, если он импортируется; иначе удалить файл и поправить импорты типов. `findQuestionTypeOption` убрать (заменён стором).
- **3.5** тесты потребителей (modify) — existing answer-input specs (EmojiRating/YesNo) + QuestionEditForm spec: замокать/инициализировать стор. Зеркалить vitest-паттерн (Pinia `createTestingPinia` или реальный стор с засидженными types).
- Invariant: хардкод удалён; компоненты не крашатся до гидрации.
- Commit: `refactor(goals): consume question types from store, drop hardcoded copy`

### Test strategy (TDD: yes)
- Бэк: `question-types.controller.spec` (Phase 1) — все типы, порядок, options.
- Фронт стор: `question-types-store.spec` (Phase 2) — идемпотентность, геттеры.
- Потребители: обновить existing specs (Phase 3), добавить кейс «рендер из стора».

### Order & dependencies
Phase 1 независима (бэк). Phase 2 зависит от формата ответа (Phase 1 DTO). Phase 3 зависит от стора (Phase 2). Последовательно 1→3.

### Backwards-compat
Greenfield эндпоинт + новый стор. Риск — answer-inputs ломаются от синхронного→асинхронного чтения; митигируется `computed` + load-на-старте (Phase 2.3, 3.1). Удаление `QUESTION_TYPE_OPTIONS` — все 7 потребителей перепроводятся в Phase 3 (consistency pass обязателен: grep на остаточные импорты).

## Verify

**Result:** passed

Positive:
- BE: build ✓, тесты **303** (+7 controller spec); FE: typecheck ✓, build ✓, тесты **269** (+9: стор 6 + before-hydration 3)
- Live `GET /api/question-types` → 7 типов с корректными options (rating/emoji/yes-no/time)
- Стор: `load` идемпотентен, геттеры `options`/`label` (unit)

Negative:
- Route не перехвачен: отдельный префикс `question-types`; `GET /api/questions/19` → 200 (не сломан)
- answer-input до гидрации стора (пустой options) → рендерит без краша (unit: emoji 0 кнопок, yes_no дефолт-лейблы)

Invariants:
- Эндпоинт **буква-в-букву == bot `QUESTION_TYPES`** — программная сверка (7 типов, label/example/options совпали)
- Хардкод удалён — `grep QUESTION_TYPE_OPTIONS/findQuestionTypeOption src tests` пусто; `question-types.ts` удалён
- `answer-format.ts` не тронут (логика индекс/yes-no осталась)

Smoke: live `GET /api/question-types` → 7 типов, идентичны константе бота — единый источник подтверждён (бэк на копии БД).

## Conclusion

Outcome: типы вопросов приходят с бэка (`GET /api/question-types`) через Pinia-стор как единый источник истины; хардкод-копия `QUESTION_TYPE_OPTIONS` удалена. HEAD: `343ff94`.

Invariants:
- Единый источник — бэк `QUESTION_TYPES`; хардкод удалён (`question-types.ts` removed, grep пусто); эндпоинт буква-в-букву == константа бота (программная сверка)
- `GET /question-types` без потерь/переупорядочивания + options — отдельный `@Controller('question-types')`, коллизии с `questions/:id` нет (live `questions/19` → 200)
- answer-format-логика осталась на фронте (не тронут)
- answer-inputs не крашатся до гидрации (computed + фоллбэки)

Review findings:
- Critical (reviewer): `load()` звался только в `main.ts` (лишь при токене на старте) — свежий логин через `LoginView` (SPA-навигация) типы не грузил → формы цели пустые всю сессию. Fixed `343ff94`: загрузка перенесена в router guard (единый чокпоинт на любом входе в авторизованную часть, стор идемпотентен), убраны избыточные вызовы из `main.ts`, + регрессия-тест `tests/router/question-types-load.spec.ts`.

Verified by: live `GET /api/question-types` == bot `QUESTION_TYPES` (7 типов, программная сверка) на запущенном бэке/копии БД; guard-фикс — unit-регрессия.

### Hands-off decisions
<empty — populated only when Mode is hands-off>

### Deferred (needs user input)
<empty — populated only when Mode is hands-off and a choice had no conservative default>
