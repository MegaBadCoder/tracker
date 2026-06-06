# Global Goals

**Status:** planning
**Branch:** main
**Worktree:** none
**Mode:** interactive

## Design

### Цель и модель
«Глобальная цель» (по Ч. Дахигу — надцель) = `Goal` с флагом `is_global=true`, **без отчётов** (questions запрещены), может быть родителем обычных целей. Иерархия — ровно **2 уровня**: global → обычные. Прогресс не автоматизируется: global просто видна, дети живут независимо. Признак глобальности — флаг `is_global`, а не отдельный тип/сущность (решение пользователя). Родительство опционально.

### Entity (`alfy-bot/src/shared/entities/goal.entity.ts`)
- `+ is_global: boolean` — `@Column({ default: false })`
- `+ parent_goal_id: number | null` — nullable self-FK
- self-relation: `@ManyToOne(() => Goal) parent` + `@OneToMany(() => Goal) children`
- `goal_start`, `goal_end` → **nullable** (`type: 'text', nullable: true`)
- SQLite `synchronize:true` добавит колонки при старте; старые строки → `is_global=false`, `parent_goal_id=NULL`.

### Backend API
- `POST /goals` — `CreateGoalDto` + опц. `is_global`, `parent_goal_id`. Если `is_global` — даты опциональны; иначе как сейчас. Проверка «end позже start» в контроллере — только когда обе даты заданы.
- `PATCH /goals/:id` — `UpdateGoalDto` + опц. `parent_goal_id` (`null` = отвязать). Валидация правил иерархии.
- `GET /goals?scope=global|regular|all` (default `all` = текущее поведение), комбинируется с `?status=`. `regular` = `is_global=false`.
- `GET /goals/:id` — для global встраивает `children: GoalDto[]` (обычные цели с этим `parent_goal_id`).
- `GoalDto` += `is_global`, `parent_goal_id`; `goal_start/goal_end` → `string | null`.

### Telegram-бот (минимально, не ломать)
- `create-goal.scene` / `edit-goal.scene` создают **обычные** цели как раньше (`is_global=false` по дефолту), без новых шагов.
- `list-goals.scene` (`:267`, `:322`) форматирует даты → **null-guard** (global без дат не должна падать). Создание global в боте — out of scope.

### MCP (alfy-mcp) — расширяем
- `create_goal` += опц. `is_global`, `parent_goal_id`; `goal_start/goal_end` → опциональны.
- `update_goal` += опц. `parent_goal_id`.
- `list_goals` += опц. `scope`.

### Frontend
- **types** (`types/index.ts`): `Goal` += `is_global`, `parent_goal_id`, опц. `children?: Goal[]`; `goal_start/goal_end` → `string | null`. `GoalType` (`SIMPLE|SMART|GLOBAL`) уже есть.
- **Сайдбар** (через существующий `sectionNav`-паттерн, см. `AppLayout.vue:15-31`): на роут `/` повесить `meta.sectionNav: 'goals'` + `goalsNavLinks` со ссылками-фильтрами **Все / Глобальные / Другие** (через `?scope=`). `HomeView` читает `route.query.scope`; статус-Tabs остаются.
- **Create-flow** (`use-goal-create-flow.ts`): включить тип `global` (сейчас disabled). Для global — пропуск шагов questions, даты опциональны. Для `simple` — опциональный шаг «привязать к глобальной цели».
- **GoalView**: для global вместо questions — список `children` (навигация в каждого) + «создать/привязать ребёнка»; для обычной — ссылка на родителя + смена родителя.
- **GoalCard**: бейдж «Global»; **null-guard на даты** (`dates.ts`, `GoalCard.vue`).

### Tradeoffs
- **Встраивание `children` в GET /goals/:id** vs отдельный endpoint: выбрано встраивание — 1 round-trip, детей немного. Минус — чуть тяжелее ответ; приемлемо.
- **Nullable даты в entity** vs фейковые даты для global: выбрано nullable — честнее модели «бессрочная надцель». Цена — null-guards в 3 местах отображения (бот list-goals, GoalCard, dates.ts).

### Backwards-compat
- **`goal_start/goal_end` → nullable** — главный риск. Существующие строки имеют значения. TS-тип `string → string|null` затрагивает форматирование дат: `list-goals.scene` (бот), `GoalCard.vue`, `dates.ts` → добавить null-guards. `report.service` global не трогает (нет questions); `goal.service.ts:83` уже null-safe.
- Новые nullable-колонки — `synchronize:true` добавит безопасно.
- Существующие create/update (web/бот/MCP) создают обычные цели — `is_global` дефолт `false`.
- `GET /goals` без `scope` = старое поведение.

### Unknowns
- Точный UX выбора global-родителя в create-flow и «привязать ребёнка» в GoalView — детализируем в `up:uplan` (переиспользуем существующие шаги/списки).

TDD: yes (валидация правил parent/global, scope-фильтр, repository children-запросы на бэке; роутинг create-flow для global и scope-фильтр на фронте — детерминированы, регрессии критичны).

### Invariants
- `is_global=true` ⇒ у цели нет и не может быть questions (`POST /goals/:id/questions` → 400).
- `is_global=true` ⇒ `parent_goal_id IS NULL` (иерархия ровно 2 уровня; global без родителя).
- `parent_goal_id` задан ⇒ родитель существует, owned-by-user и `is_global=true`.
- null `goal_start`/`goal_end` допустимы только при `is_global=true`; обычные цели всегда с датами.
- Все операции с целью проходят через `assertOwnedGoal` — нет обхода владельца.

### Principles
- Переиспользуем существующие паттерны (sectionNav сайдбара, create-flow шаги, assertOwnership) — без новых механизмов.
- YAGNI: без авто-прогресса, без вложенности global, без отдельной сущности — только флаг + self-FK.
- Fail fast на нарушении иерархии — `BadRequestException`, не тихий фолбэк.
- Презентация дат с null-guard, а не фейковые даты.

## Plan
<empty — filled by up:uplan>

## Verify
<empty — filled by up:uverify>

## Conclusion
<empty — filled by up:ureview>
