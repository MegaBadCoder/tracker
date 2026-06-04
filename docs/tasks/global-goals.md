# Global Goals

**Status:** done
**Branch:** feat/global-goals (base: origin/main @ 9b2e5b4)
**Worktree:** .worktrees/feat-global-goals
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

Approach: 6 фаз, каждая — отдельный коммит. Бэкенд снизу вверх (entity+repo+service → DTO+controller+правила), затем MCP, затем null-guard бота, затем фронт (типы+API+сайдбар-фильтр → create-flow global + GoalView дети). Порядок даёт независимо тестируемые слои; флаг `is_global` принимается на каждом слое до того, как появляется UI.

Сущность `Goal` НЕ получает колонку `type` — глобальность это `is_global` (решение из Design). Существующий `GOAL_TYPE_CONFIG` (`shared/constants/goal-types.ts`) — только для UI-выбора в боте, к хранению не относится.

### Phase 1 — Backend: entity + repository + service

- **1.1** `alfy-bot/src/shared/entities/goal.entity.ts:18-26` (modify)
  - `+ @Column({ default: false }) is_global: boolean;`
  - `+ @Column({ type: 'integer', nullable: true }) parent_goal_id: number | null;`
  - `+ @ManyToOne(() => Goal, (g) => g.children, { nullable: true }) @JoinColumn({ name: 'parent_goal_id' }) parent?: Goal | null;`
  - `+ @OneToMany(() => Goal, (g) => g.parent) children: Goal[];`
  - `goal_start`, `goal_end` → `@Column({ type: 'text', nullable: true }) goal_start: string | null;` (и `goal_end`).
  - Invariant: только флаг + self-FK (Principle YAGNI); 2 уровня держится валидацией в Phase 2, не схемой.
- **1.2** `alfy-bot/src/modules/goal/domain/goal-repository.port.ts:12-41` (modify)
  - `create(...)`: расширить литеральный тип `goalData` полями `is_global?: boolean; parent_goal_id?: number | null;`, даты сделать опциональными в литерале.
  - `+ abstract findAllByUser(userId: number, scope?: 'global' | 'regular' | 'all'): Promise<Goal[]>;` (расширить сигнатуру существующего).
  - `+ abstract findByStatus(userId: number, status: string, scope?: 'global' | 'regular' | 'all'): Promise<Goal[]>;`
  - `+ abstract findChildren(parentGoalId: number): Promise<Goal[]>;`
- **1.3** `alfy-bot/src/modules/goal/infrastructure/typeorm-goal.repository.ts` (modify)
  - `create` (`:60-65` else-ветка): спред `...goalData` уже протащит `is_global`/`parent_goal_id`; убрать хардкод дат-требования (тип). Оставить `status: 'active'`.
  - `findAllByUser` (`:84-90`), `findByStatus` (`:92-98`): добавить параметр `scope`, при `global`/`regular` добавить `is_global: scope === 'global'` в `where`.
  - `findById` (`:100-106`): добавить `'children'` в `relations` (для встраивания детей global-цели).
  - `+ findChildren(parentGoalId)`: `this.goalRepo.find({ where: { parent_goal_id: parentGoalId, status: Not('deleted') }, relations: ['questions'], order: { createdAt: 'DESC' } })`.
- **1.4** `alfy-bot/src/modules/goal/application/goal.service.ts` (modify)
  - `findAllByUser`/`findByStatus`: пробросить `scope`.
  - `+ async assertValidParent(userId: number, parentGoalId: number): Promise<void>` — load `findById(parentGoalId)`; throw `BadRequestException` если не найден / `user_id !== userId` / `!is_global`.
  - `+ async findChildren(parentGoalId)`: проброс в repo.
  - Invariant: `parent_goal_id` ⇒ родитель owned-by-user и `is_global=true`.
- **1.5** `alfy-bot/src/modules/goal/infrastructure/typeorm-goal.repository.spec.ts` (create, TDD) — in-memory sqlite: create с `is_global=true`/`parent_goal_id` пишет колонки; `findChildren` возвращает только детей этого родителя без `deleted`; `findAllByUser('global'|'regular')` фильтрует по флагу; `findById` встраивает `children`.
- Commit: `feat(goals): is_global + parent self-relation in entity/repo/service`

### Phase 2 — Backend: DTO + controller + правила иерархии

- **2.1** `alfy-bot/src/modules/goal/dto/create-goal.dto.ts` (modify)
  - даты: обернуть `@ValidateIf((o) => !o.is_global)` перед `@IsString()/@Matches` у `goal_start`/`goal_end` (для global даты не валидируются/опциональны), тип → `string | null` либо опционально.
  - `+ @IsOptional() @IsBoolean() is_global?: boolean;`
  - `+ @IsOptional() @IsInt() @Min(1) parent_goal_id?: number;`
- **2.2** `alfy-bot/src/modules/goal/dto/update-goal.dto.ts:5-18` (modify)
  - `+ @IsOptional() @ValidateIf(...) parent_goal_id?: number | null;` (`null` = отвязать; принять и `IsInt`, и `null`).
- **2.3** `alfy-bot/src/modules/goal/dto/goal-response.dto.ts:76-97` (modify)
  - `goal_start`/`goal_end` → `string | null` (Swagger `nullable: true`).
  - `+ is_global: boolean;` `+ parent_goal_id: number | null;` `+ @ApiPropertyOptional({ type: () => [GoalDto] }) children?: GoalDto[];`
- **2.4** `alfy-bot/src/modules/goal/goal.controller.ts:97-114` (modify, `create`)
  - дату-валидацию (`:101-110`) выполнять только если обе даты заданы; иначе пропустить.
  - если `dto.is_global && dto.parent_goal_id` → `BadRequestException` (global без родителя).
  - если `dto.parent_goal_id` → `await this.goalService.assertValidParent(req.user.sub, dto.parent_goal_id)`.
- **2.5** `alfy-bot/src/modules/goal/goal.controller.ts:58-72` (modify, `findAll`)
  - `+ @Query('scope') scope?: 'global'|'regular'|'all'`; пробросить в `findByStatus`/`findAllByUser`. `@ApiQuery` для scope.
- **2.6** `alfy-bot/src/modules/goal/goal.controller.ts:79-90` (modify, `findOne`)
  - для global-цели догрузить детей: `if (goal.is_global) goal.children = await this.goalService.findChildren(goal.id)` (или полагаться на relation из 1.3 — выбрать relation, проще). Вернуть как `GoalDto`.
- **2.7** `alfy-bot/src/modules/goal/goal.controller.ts:122-151` (modify, `addQuestions`)
  - после `assertOwnedGoal`: если `goal.is_global` → `BadRequestException('global goal cannot have questions')`. Invariant: global ⇒ нет questions.
- **2.8** `alfy-bot/src/modules/goal/goal.controller.ts:158-177` (modify, `update`)
  - если `'parent_goal_id' in dto`: при `!== null` → `assertValidParent` + проверить, что сама цель `!is_global` (global нельзя дать родителя) → иначе 400; затем `goalService.update(id, { parent_goal_id: dto.parent_goal_id })`.
- **2.9** `alfy-bot/src/modules/goal/goal.controller.spec.ts` (modify, TDD) — create global без дат ok; create обычной без дат → 400; create с parent не-global → 400; create global+parent → 400; addQuestions на global → 400; PATCH parent_goal_id валидный/невалидный; GET ?scope фильтрует; GET :id global встраивает children.
- Commit: `feat(api): global-goal create/update/list rules + children embed`

### Phase 3 — MCP tools

- **3.1** `alfy-mcp/src/tools/goals.ts:40-54` (`create_goal`) — `goal_start/goal_end` → `.optional()`; `+ is_global: z.boolean().optional()`, `+ parent_goal_id: z.number().int().positive().optional()`; пробросить в body только заданные.
- **3.2** `alfy-mcp/src/tools/goals.ts:79-96` (`update_goal`) — `+ parent_goal_id: z.number().int().positive().nullable().optional()`; класть в body если `!== undefined`.
- **3.3** `alfy-mcp/src/tools/goals.ts:10-24` (`list_goals`) — `+ scope: z.enum(['global','regular','all']).optional()`; в params если задан.
- **3.4** `alfy-mcp/tests/tools/goals.spec.ts` (modify, TDD) — create с `is_global`/`parent_goal_id` шлёт их в POST; update с `parent_goal_id: null` шлёт null; list со `scope` кладёт param.
- Commit: `feat(mcp): expose is_global/parent_goal_id/scope on goal tools`

### Phase 4 — Bot: null-guard дат в списке целей

- **4.1** `alfy-bot/src/modules/bot/scenes/list-goals.scene.ts:267,322` (modify) — обернуть формат дат: если `goal.goal_start`/`goal_end` пустые — выводить «бессрочная» (или скрывать строку периода), а не `new Date(null)`. Вынести в приватный хелпер `formatGoalPeriod(goal)`.
- **4.2** соответствующий `*.spec.ts` если существует — добавить кейс global-цели без дат (не падает, корректный текст). Иначе — без теста (тривиальный guard, покроется uverify).
- Commit: `fix(bot): null-safe goal period for dateless global goals`

### Phase 5 — Frontend: типы + API + сайдбар-фильтр

- **5.1** `alfy-bot-frontend/src/types/index.ts:47-55` (modify) — `Goal`: `goal_start`/`goal_end` → `string | null`; `+ is_global: boolean`; `+ parent_goal_id: number | null`; `+ children?: Goal[]`.
- **5.2** `alfy-bot-frontend/src/api/goals.ts` (modify)
  - `CreateGoalDto` (`:10-14`): `goal_start?`/`goal_end?` опциональны; `+ is_global?: boolean`; `+ parent_goal_id?: number`.
  - `UpdateGoalDto` (`:26-29`): `+ parent_goal_id?: number | null`.
  - `fetchGoals` (`:31-36`): сигнатура `(opts?: { status?; scope?: 'global'|'regular'|'all' })`, класть оба в params.
- **5.3** `alfy-bot-frontend/src/router/goals-nav.ts` (create) — `goalsNavLinks: NavLink[]` = Все (`/`), Глобальные (`/?scope=global`), Другие (`/?scope=regular`); иконки lucide (`Target`, `Globe`, `ListChecks`).
- **5.4** `alfy-bot-frontend/src/router/index.ts:13-16` (modify) — на home-роут (`name: 'home'`) `meta: { sectionNav: 'goals' }`.
- **5.5** `alfy-bot-frontend/src/components/AppLayout.vue:15-21` (modify) — в `sectionNavRegistry` `+ goals: goalsNavLinks`.
- **5.6** `alfy-bot-frontend/src/components/SidebarNav.vue:30-35` (modify) — active-state учитывает `route.query.scope` для goals-ссылок (точное совпадение path+scope), чтобы подсветка работала на `/?scope=`.
- **5.7** `alfy-bot-frontend/src/views/HomeView.vue` (modify) — читать `route.query.scope`; `load()` передаёт `{ status, scope }` в `fetchGoals`; реагировать на смену query.
- **5.8** `alfy-bot-frontend/src/components/GoalCard.vue:42-49` (modify) — null-guard дат (если нет дат — не рендерить период или «Бессрочная»); бейдж «🌍 Global» при `goal.is_global`; счётчик вопросов скрыть для global (показать «N целей» по `children`, если есть).
- **5.9** Tests (TDD): `tests/api/goals.spec.ts` (или существующий) — `fetchGoals` кладёт `scope`; `tests/components/GoalCard.spec.ts` (create) — global без дат рендерится без падения + бейдж.
- Commit: `feat(frontend): goal types, scope filter in sidebar, global GoalCard`

### Phase 6 — Frontend: create-flow global + GoalView дети/родитель

- **6.1** `alfy-bot-frontend/src/features/goals/ui/steps/goal-types.ts:17` (modify) — `global` → `enabled: true`.
- **6.2** `alfy-bot-frontend/src/features/goals/model/use-goal-create-flow.ts` (modify)
  - `selectType` (`:124-127`): для `global` → шаг `name` (как simple), не `type_in_development`.
  - после `name`: для global пропускать `start/end/point_a/questions_offer` — вести к опциональному дедлайн-шагу затем `creating`; для simple — оставить как есть, плюс опциональный шаг выбора global-родителя (новый шаг `parent` после `point_a`, перед `creating`).
  - `FlowState` (`:36-46`): `+ deadline?: Date` (опц. для global), `+ parentGoalId?: number` (опц. для simple).
  - `buildCreatePayload` (`:384-394`): для global — `is_global: true`, даты только если заданы; для simple с `parentGoalId` — `parent_goal_id`.
  - `submitCreateGoal` (`:400-407`): для global после создания → сразу `done` (нет questions_offer).
  - новые `Step`: `+ 'q_deadline'`/`'parent'` (минимально — переиспользовать `EndDateStep`/новый компактный select).
- **6.3** `alfy-bot-frontend/src/views/GoalCreateView.vue:50-67,69-111` (modify) — добавить новые шаги в `stepMap`; ветка `done` для global уже редиректит на goal.
- **6.4** новые степ-компоненты при необходимости: `GlobalDeadlineStep.vue` (опц. дедлайн/пропустить), `ParentGoalStep.vue` (список global-целей через `fetchGoals({ scope: 'global' })` + «без родителя»). Стиль — как существующие степы.
- **6.5** `alfy-bot-frontend/src/views/GoalView.vue` (modify)
  - для `goal.is_global`: вместо секции «Вопросы цели» (`:366-419`) — секция «Цели внутри» со списком `goal.children` (навигация в `/goals/:childId`) + кнопка «Создать цель здесь» (deep-link в create с предвыбранным родителем) ; скрыть SummaryCard-дни если нет дат.
  - для обычной цели: показать ссылку на родителя (если `parent_goal_id`) + действие «Переместить в глобальную цель» (PATCH `parent_goal_id`).
- **6.6** Tests (TDD): `tests/features/goals/use-goal-create-flow.spec.ts` (modify) — global: `selectType('global')` ведёт на `name`, пропускает questions, payload `is_global:true`, даты опц.; simple с parent кладёт `parent_goal_id`. `tests/views/GoalView` (если есть/создать) — global рендерит children-секцию, не questions.
- Commit: `feat(frontend): create global goals + children/parent in GoalView`

### Test strategy

TDD: yes. Порядок «тест → код» в каждой фазе.
- Бэк: repository.spec (Phase 1), goal.controller.spec (Phase 2) — правила/фильтры/встраивание.
- MCP: goals.spec (Phase 3) — проброс новых полей.
- Фронт: use-goal-create-flow.spec, GoalCard.spec, api goals.spec (Phase 5–6).
- Бот (Phase 4): null-guard — покрытие в uverify, юнит опционален.
- После каждой фронт-фазы: `npx vue-tsc --noEmit -p tsconfig.app.json`.
- Baseline удержать зелёным: alfy-bot 246, frontend 206, alfy-mcp 110.

### Order & dependencies

- Phase 1 → 2 (controller использует repo/service-методы).
- Phase 3 (MCP) зависит от Phase 2 (REST-контракт), но тестируется моками — можно после 2.
- Phase 4 независим (только бот-формат), но логически после 1 (entity nullable).
- Phase 5 → 6 (6 использует типы/API/шаги из 5).
- Бэк (1–2) блокирует фронт (5–6) по контракту, но фронт-тесты на моках.

### Backwards-compat

- **`goal_start/goal_end` → nullable** (Phase 1): существующие строки имеют значения. Затрагивает: бот `list-goals.scene` → null-guard (Phase 4); фронт `GoalCard`/`dates` → null-guard (Phase 5.8); `GoalDto` тип (Phase 2.3). `report.service` global не трогает (нет questions); `goal.service.ts:83` уже null-safe.
- Новые nullable-колонки `is_global`/`parent_goal_id` — SQLite `synchronize:true` добавит, старые строки → `false`/`NULL`.
- `GET /goals` без `scope` = старое поведение; create/update без новых полей = обычная цель.
- MCP/бот старые вызовы создают обычные цели — без изменений в поведении.

### Open questions / risks

- **class-validator `@ValidateIf` + `whitelist:true`**: глобальный `ValidationPipe({ whitelist: true })` срежет неизвестные поля — убедиться, что `is_global`/`parent_goal_id` объявлены в DTO (иначе вырежутся). Проверка в Phase 2.
- **Встраивание children через relation vs явный запрос** (2.6): выбрать одно при реализации — relation проще, но грузит детей для всех `findById` (в т.ч. обычных целей). Если шумит — явный `findChildren` только для global. Решить в Phase 2, по умолчанию явный запрос (только для global).
- **Active-state сайдбара по query** (5.6): `route.path === to` не сmatchится с `?scope` — нужна query-aware проверка, иначе подсветка неверная. Заложено.
- Откат: каждая фаза — отдельный коммит, `git revert` точечно; колонки nullable, code-only откат безопасен.

## Verify

**Result:** passed

Positive:
- alfy-bot: `nest build` → `dist/src/main.js`; тесты **270/270** (246 baseline + 24)
- alfy-bot-frontend: `vue-tsc --noEmit` чисто; `vite build` (sw.js); тесты **234/234** (206 + 28)
- alfy-mcp: `tsc` build чисто; тесты **118/118** (110 + 8)
- Smoke (реальный service+repo+sqlite): create global без дат → `is_global=true`, даты `null`; child под global; `findChildren` → [child]; scope `global`/`regular` фильтруют корректно

Negative:
- create обычной цели без дат → 400 (DTO `@ValidateIf`, `goal.controller.spec`)
- create global + parent_goal_id → 400 (`goal.controller.ts:114`)
- update: дать родителя global-цели → 400 (`goal.controller.ts:205`)
- parent_goal_id указывает на не-global → 400 (`assertValidParent`, smoke)
- parent_goal_id чужого юзера → 400 (`assertValidParent`, smoke)
- addQuestions на global → 400 (`goal.controller.ts:157`, controller.spec)

Invariants:
- `is_global` ⇒ нет questions — reject в `addQuestions`
- `is_global` ⇒ `parent_goal_id IS NULL` — reject в create и update
- `parent_goal_id` ⇒ родитель owned-by-user и global — `assertValidParent` (smoke: все 3 режима отказа)
- null `goal_start/goal_end` только при global — DTO `@ValidateIf`; null-guards в `list-goals.scene`, `GoalCard.vue`, `GoalView.vue`

Smoke: реальный HTTP-e2e нереализуем — пре-существующая поломка e2e-харнесса (telegraf бросает `401 Bot Token is required` на `app.init()`, тот же креш на baseline `tasks.e2e`); заменён на реальный roundtrip service+repo против sqlite.

Notes:
- Браузерный UI-smoke (клик-через) не запускался — покрыт component/flow vitest (`use-goal-create-flow.spec`, `GoalView.spec`, `GoalCard.spec`).
- `alfy-mcp/package-lock.json` (M) — артефакт `npm install` при baseline-настройке, вне фичи.

## Conclusion

Outcome: глобальные цели (`is_global` + опциональный `parent_goal_id`, 2 уровня) поддержаны end-to-end — backend/bot/MCP/web, с сайдбар-фильтром Все/Глобальные/Другие. HEAD: `a51575e`.

Invariants:
- `is_global` ⇒ нет questions — `addQuestions` reject (`goal.controller.ts:157`); controller.spec
- `is_global` ⇒ `parent_goal_id IS NULL` — reject в create (`:114`) и update (`:205`)
- `parent_goal_id` ⇒ родитель owned-by-user и global — `assertValidParent` (`goal.service.ts:90`); smoke прогнал все 3 режима отказа
- null даты только при global — DTO `@ValidateIf` (whitelist-safe, эмпирически проверено); null-guards в `list-goals.scene`, `GoalCard.vue`, `GoalView.vue`
- все операции через `assertOwnedGoal` — без обхода владельца
- 2 уровня структурно: родителем может быть только global, а global нельзя дать родителя ⇒ 3-го уровня нет (ревьюер пытался пробить — не нашёл escape)

Review findings: оба ниже Important-порога, пофикшены в `a51575e`:
- GoalCard в списке показывал «0 вопросов» на global (children не embed'ятся в list) → счётчик скрыт для global.
- Устаревший комментарий `back()` в GoalCreateView → актуализирован.

Future work:
- Web UI: пропускать шаг выбора родителя в simple-create, когда global-целей ещё нет — Justification: полировка, вне плана (см. Known UX notes).
- Предвыбор родителя через `?parent=` при «Создать цель здесь» — Justification: план явно допускал fallback без prefill.
- Создание/редактирование global в Telegram-боте — Justification: Design out of scope (web+MCP focus).

Verified by: реальный smoke service+repo+sqlite (HTTP-e2e нереализуем — пре-существующий telegraf-401 креш e2e-харнесса, тот же на baseline `tasks.e2e`); браузерный UI-smoke не запускался (покрыт vitest 234).

### Deviations from plan
- Phase 1: nullable-даты (бул 1.1) сломали `tsc` в consumer-файлах вне списка фазы — добавлены null-guards в `report.service.ts` (fail-fast: `BadRequestException` в аналитике, `null` в scan), `edit-goal.scene.ts` (`?? undefined`), `list-goals.scene.ts` (условный рендер периода). `925a9de`.
- Phase 4 (null-guard дат в `list-goals.scene`) фактически выполнен в Phase 1 — на фазе 4 остаётся только проверка/опц. тест.
- Phase 5: смена типа дат на `string | null` потребовала минимальный null-guard в `GoalView.vue` (даты → «—», `daysLeftVal` → 0 при null) — вне списка буллетов фазы, но behavior-preserving для обычных целей. `804ae66`.
- Phase 6: «Создать цель здесь» из global-цели ведёт на обычный create без предвыбора родителя (`?parent=` не прокинут) — план явно допускал этот fallback; родителя юзер выбирает в `ParentGoalStep`. `e1b6e39`.
- Phase 6: шаг `parent` (выбор global-родителя) теперь всегда в simple-flow между `point_a` и `creating` — по Design (родитель при создании). При отсутствии global-целей шаг показывает «Пока нет глобальных целей» + «Без родителя» (мягкое трение, не блокер).
- Phase 6: «Открепить» родителя вызывает `updateGoal(id,{parent_goal_id:null})` без confirm-диалога (низкорисковое обратимое действие); move/unlink встроены в существующий goal-actions DropdownMenu, а не отдельной кнопкой.

### Known UX notes (для review)
- Simple-create теперь на 1 шаг длиннее (parent-select) даже когда global-целей нет. Возможная полировка: пропускать шаг при пустом списке — отложено, не входило в план.
