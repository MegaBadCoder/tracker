# Alfy MCP Server

**Status:** done
**Branch:** feat/alfy-mcp
**Worktree:** .worktrees/feat-alfy-mcp
**Mode:** interactive

## Seed

Новый пакет `alfy-mcp/` в монорепо рядом с `alfy-bot/` и `alfy-bot-frontend/`. Тонкая обёртка поверх REST API `localhost:3002/api`, не дублирует бизнес-логику.

**Транспорты:**
- stdio — для Claude Desktop / Claude Code локально
- HTTP + SSE — для удалённых клиентов и будущей интеграции с ботом

**Auth:** API-токены, выдаваемые через новую команду `/mcp_token` в Telegram-боте. Long-lived, ревокабельные, per-user.

**Scope MVP — полный CRUD + аналитика:**
- **goals** — list / get / create / update / delete + связь с задачами
- **tasks** — list / get / create / update / complete / delete + фильтры (project / status / date)
- **questions** — list / answer
- **get_progress** — агрегаты по целям и задачам

**Backend контекст:** уже существуют модули `alfy-bot/src/modules/{goal,question,task}` с Clean Architecture (port + adapter + REST). MCP должен переиспользовать REST, не лезть в TypeORM напрямую.

**Размер:** Medium.
**Режим:** Interactive.

## Design

### Purpose

Дать Claude (через MCP-протокол) возможность читать и менять данные Alfy: цели, привычки, задачи, отвечать за пользователя на вопросы привычек, получать сводки прогресса. Сейчас весь write-flow живёт в Telegram-боте или фронте; MCP открывает третий канал — agentic.

### Scope

Новый пакет `alfy-mcp/` в монорепо. Деплоится **отдельным docker-сервисом** рядом с `alfy-bot`. Один процесс, два транспорта:
- **stdio** — для локального Claude Desktop/Code. Запускается как `npx tsx src/cli.ts --stdio` или через published бинарь.
- **HTTP/SSE** — для удалённых клиентов. Внутренний порт `3003`, Caddy роутит `tracker.rocketup.tech/mcp/*` → `alfy-mcp:3003`.

MCP — **тонкая HTTP-обёртка над REST `alfy-bot`**. Никакого прямого доступа к TypeORM, никакой дубль-валидации. Tool-handler ≈ 1 HTTP-вызов; для `get_progress` — 2-3.

### Backend extensions (необходимый минимум в этой же таске)

Текущий REST на origin/main покрывает большую часть scope, но двух кусков нет:

1. **POST `/api/questions/:id/answers`** — отметить выполнение/значение привычки за дату. Логика сейчас живёт в `bot/scenes/report.scene.ts` — выносим в `ReportService.recordAnswer(userId, questionId, scheduledDate, value)` (или `QuestionService`, по месту), биндим REST поверх.

2. **API-token инфра:**
   - Entity `ApiToken { id, user_id, name, token_hash, last_used_at, created_at, revoked_at? }` (synchronize: true автоматизирует миграцию).
   - Bot-команды: `/mcp_token <name>` (генерирует, показывает один раз), `/mcp_tokens` (список по `name` + last4 + `last_used_at`), `/mcp_token_revoke <id>`.
   - `ApiTokenAuthGuard` — bearer-токен → ищет hash в БД через bcrypt-compare, при попадании кладёт `JwtPayload`-совместимый объект в `req.user`. Защищает либо отдельный префикс `/api/mcp-bridge/*`, либо всё `/api/*` параллельно с JwtAuthGuard (см. "Approach" ниже).

### Approach (выбранный)

**One MCP process, two transports, через bridge поверх REST.**

```
Claude Desktop/Code (stdio) ─┐
                              ├─→ alfy-mcp (Node + @modelcontextprotocol/sdk)
Remote client (HTTP/SSE) ────┘        │
                                       │ bearer = API token
                                       ↓
                              alfy-bot REST :3002/api
                                       │
                                       ↓
                              SQLite (existing)
```

**Auth handshake (per request):**
1. Клиент шлёт MCP-вызов, в env (stdio) или в header (HTTP) — `ALFY_API_TOKEN`.
2. MCP проксирует REST-запрос с `Authorization: Bearer <token>`.
3. `ApiTokenAuthGuard` на REST: SHA-256 префикс ищется в БД (для быстроты), bcrypt-verify хеша, `last_used_at = now`, кладёт user в request.
4. Дальше — обычный controller-flow.

**Tool surface (MCP — финальная форма):**

Goals: `list_goals(status?)`, `get_goal(id)`, `create_goal(...)`, `add_questions_to_goal(goal_id, questions[])`, `update_goal(id, name?, status?)`.

Tasks: `list_tasks(project_id?, status?, due_date_from?, due_date_to?)`, `get_task(id)`, `create_task(...)`, `update_task(id, ...)`, `complete_task(id)`, `delete_task(id)`.

Questions/habits: `list_habits(days?)`, `get_question(id)`, `create_habit(...)`, `update_habit(id, ...)`, `update_habit_schedule(id, frequency_type, ...)`, `delete_habit(id)`, `answer_question(id, scheduled_date, value)`, `get_question_analytics(id)`.

Progress: `get_progress(period: today|week)` → `{ goals: [{id, name, answered, scheduled, missed, streak}], tasks: { total, completed, overdue, by_project? } }`. Считается в памяти MCP из `list_goals` + `analytics` + `list_tasks`.

### Tradeoffs

| Решение | За | Против | Перевес |
|---|---|---|---|
| `alfy-mcp/` отдельный пакет (не внутри alfy-bot) | Чистые boundaries, отдельный жизненный цикл, можно убить/перезапустить без бота | +1 docker-сервис, +1 Dockerfile, IPC через HTTP | Изоляция и независимый деплой |
| Один процесс stdio+HTTP | Меньше кода, общий tool-registry, режим выбирается флагом | Чуть больше связанности | За |
| Bcrypt-hashed tokens, multiple per user | Безопасно при дампе БД, ревокабельно по одному | Больше кода чем JWT-share | За |
| REST-bridge (а не прямой DI к сервисам) | Бэк остаётся единственным владельцем бизнес-логики; легко логировать | +HTTP overhead ~5-15ms на вызов | За |
| Progress in-memory в MCP | Не множим endpoint'ы; меняется только в MCP | Несколько REST-вызовов за один tool | За (Pareto) |

### Unknowns

- **MCP SDK совместимость** — `@modelcontextprotocol/sdk` (TS) ESM-only. Используем отдельный tsconfig для пакета, без зависимости от CJS-сборки `alfy-bot`. Проверить в Plan-стейдже.
- **Точный shape `report.scene.ts` answer-логики** — какие поля, валидации, проверка дубликата за дату. Прочитать сцену перед написанием `recordAnswer`.
- **Caddy-конфиг для SSE** — нужен `flush_interval -1` или аналог. Проверить документацию.
- **Telegraf-команды vs scenes** — `/mcp_token` — простая команда (input one arg) или scene? Если single-shot — обычный `bot.command('mcp_token')`.

### Backwards compatibility

Greenfield пакет + аддитивные изменения бэка. Никаких breaking changes:
- Новый endpoint POST `/questions/:id/answers` — добавление.
- Новая entity `api_token` — новая таблица, synchronize: true создаст автоматически.
- Новый bot-command `/mcp_token` — нет конфликтов (нет существующих команд с таким именем).
- Новый guard `ApiTokenAuthGuard` — применяется только к новому набору контроллеров (или к существующим параллельно с JwtAuthGuard через композит-guard — решит Plan-стейдж).

### TDD

**TDD: yes** — RED → GREEN → REFACTOR на всё с логикой. Маски и моки:
- `ApiTokenAuthGuard` — unit-тесты на проверку bcrypt, last_used update, revoked_at.
- `recordAnswer` сервис — тесты на дубль за дату, валидацию значения по типу вопроса, проверку user_id.
- `progress-aggregator.ts` (новый файл в alfy-mcp) — pure function, тесты на формирование сводки из фикстур.
- Tool-handler'ы в alfy-mcp — mock REST-клиент, проверяем что входы → корректный HTTP-вызов и форматирование вывода.
- SDK transport plumbing — не тестируем (доверяем библиотеке).

### Invariants

- MCP-сервер **не ходит в БД напрямую**. Только через REST API `alfy-bot`.
- `ApiToken.token_hash` — единственное представление токена в БД. Plain-token показывается пользователю **один раз** при выдаче и никогда не логируется.
- В `alfy-bot/src/modules/bot/scenes/report.scene.ts` после рефакторинга **не остаётся бизнес-логики ответа на вопрос** — она вся в `ReportService.recordAnswer` (или `QuestionService.answer`).
- Каждый MCP tool-handler — ≤1 HTTP-вызов (исключение: `get_progress` — 3 параллельных).
- Stdout в stdio-режиме зарезервирован под MCP-протокол; вся диагностика → stderr.
- Новые таблицы/поля в БД — только `api_token`. Существующие entities не трогаем.

### Principles

- **Тонкая обёртка.** MCP не валидирует и не транслирует бизнес-правила — это работа бэка. MCP только маршалит DTO и формат ошибок MCP-протокола.
- **Fail fast, fail loud.** REST вернул 4xx/5xx — отдаём MCP-error с понятным сообщением и (если доступно) телом ошибки. Никаких silent fallback'ов.
- **Read-then-write.** Деструктивные tool'ы (delete, revoke) не маскируют существование — если REST вернул 404, отдаём 404, а не "ok".
- **Не плодим endpoint'ы.** Если data уже доступна композицией существующих GET'ов — собираем в MCP, а не пишем новый REST.
- **Один источник истины для DTO.** Где удобно — копируем shape руками. Где критично — используем shared types через `tsconfig paths`. Решение по месту.

TDD: yes (reason: auth flow, recordAnswer-логика, progress-aggregator — pure/regression-relevant; tool-handler'ы тоже test-friendly через mock REST-клиент).

## Plan

Approach: 5 фаз, аддитивные. Backend (1-3) сначала, потом MCP-пакет (4-5). `ReportService.addAnswer` уже существует — Phase 1 это просто новый REST endpoint поверх него. Бизнес-логика никуда не уезжает, скоупов сужения нет.

### Phase 1 — Backend: REST `POST /api/questions/:id/answers`

- **1.1** `alfy-bot/src/modules/question/dto/answer-question.dto.ts` (create)
  - `class AnswerQuestionDto { @IsDateString scheduled_date: string; @IsString @MaxLength(200) answer: string; }` — узкая валидация на уровне DTO.
- **1.2** `alfy-bot/src/modules/question/question.controller.ts:106` рядом с `@Patch(':id')` (modify)
  - Новый `@Post(':id/answers') async answerQuestion(@Request() req, @Param('id') id, @Body() dto: AnswerQuestionDto)` — делегирует в `reportService.addAnswer(req.user.sub, id, dto.scheduled_date, dto.answer)`.
  - Возвращает `{ ok: true }` (idempotency проверяем в существующей логике сервиса).
- **1.3** `alfy-bot/src/modules/question/question.module.ts` (modify)
  - Импортируем `ReportModule` — он уже `exports: [ReportService]`. Инжектим `ReportService` в `QuestionController`.
- **1.4** `alfy-bot/src/modules/question/question.controller.spec.ts` (modify, RED first)
  - Тест `should record answer via POST /:id/answers` — мокаем `ReportService.addAnswer`, проверяем вызов с (userId, questionId, date, answer).
  - Тест `should 400 on invalid date format` — DTO-валидация.
- Invariant: «MCP не ходит в БД» — соблюдается, MCP вызывает этот REST. «scene остаётся UI-only» — текущее состояние не меняем, бизнес-логика уже в сервисе.
- Commit: `feat(question): REST POST /:id/answers — отметить ответ за дату`

### Phase 2 — Backend: ApiToken entity + service + guard

- **2.1** `alfy-bot/src/shared/entities/api-token.entity.ts` (create)
  - Поля: `id: number @PrimaryGeneratedColumn`, `user_id: number @Index`, `name: string`, `prefix: string @Index` (10 первых символов plaintext-токена для O(1) lookup), `token_hash: string` (bcrypt от полного токена), `created_at: Date`, `last_used_at: Date | null`, `revoked_at: Date | null`.
- **2.2** `alfy-bot/src/shared/entities/index.ts` (modify) — добавить barrel-export.
- **2.3** `alfy-bot/src/app.module.ts:43-58` (modify) — добавить `ApiToken` в `entities: [...]`.
- **2.4** `alfy-bot/src/modules/auth/application/api-token.service.ts` (create)
  - `generate(userId: number, name: string): Promise<{ id: number; plaintext: string }>` — `randomBytes(24).toString('hex')` (48 hex) → `prefix = first 10`, `hash = bcrypt(plaintext, 10)`. **Plaintext возвращается только здесь**.
  - `verify(plaintext: string): Promise<number | null>` — split prefix, `findOne({ prefix, revoked_at: IsNull() })`, `bcrypt.compare(plaintext, row.token_hash)`, обновить `last_used_at = now()`, вернуть `user_id`.
  - `list(userId: number): Promise<Array<{ id, name, prefix, last_used_at, created_at }>>` — без хеша.
  - `revoke(id: number, userId: number): Promise<void>` — `update({ id, user_id }, { revoked_at: now() })`. 404 если не найдено.
- **2.5** `alfy-bot/src/modules/auth/guards/api-token-auth.guard.ts` (create)
  - `canActivate(ctx)` — берёт `Authorization: Bearer <token>` через `ExtractJwt.fromAuthHeaderAsBearerToken()`, вызывает `apiTokenService.verify(token)`, кладёт `{ sub: userId }` в `req.user` (форма совместимая с `JwtPayload`).
  - На null → `UnauthorizedException`.
- **2.6** `alfy-bot/src/modules/auth/auth.module.ts` (modify)
  - `providers: [..., ApiTokenService, ApiTokenAuthGuard]`, `exports: [..., ApiTokenService, ApiTokenAuthGuard]`, `imports: [..., TypeOrmModule.forFeature([ApiToken])]`.
- **2.7** Composite guard для REST: `alfy-bot/src/modules/auth/guards/jwt-or-api-token.guard.ts` (create)
  - Дочерний от `AuthGuard('jwt')`. Если bearer начинается с известного prefix-pattern (например `alfy_` или просто длина >= 48 hex) — делегирует в `ApiTokenAuthGuard`, иначе в `JwtAuthGuard`.
  - Используется как замена `JwtAuthGuard` в существующих контроллерах goals/tasks/questions/report. **Backwards-compat:** JWT-токены продолжают работать без изменений.
- **2.8** Replace `@UseGuards(JwtAuthGuard)` → `@UseGuards(JwtOrApiTokenGuard)` в:
  - `goal/goal.controller.ts:33`
  - `task/task.controller.ts:35`
  - `question/question.controller.ts:42`
  - `report/report.controller.ts:30`
- **2.9** Tests (RED first):
  - `api-token.service.spec.ts` — `generate` (формат, длина, prefix unique), `verify` (валид/невалид/revoked/обновление last_used_at), `revoke`, `list`.
  - `api-token-auth.guard.spec.ts` — mock req с валидным/невалидным/revoked token.
  - `jwt-or-api-token.guard.spec.ts` — диспетчинг по формату токена.
- Invariant: «ApiToken.token_hash — единственное представление в БД, plaintext показывается один раз», «новые таблицы только api_token».
- Commit: `feat(auth): ApiToken entity + service + JwtOrApiToken composite guard`

#### Snippet — verify dispatch (Phase 2.5)

```ts
async verify(plaintext: string): Promise<number | null> {
  if (plaintext.length < 48) return null;
  const prefix = plaintext.slice(0, 10);
  const row = await this.repo.findOne({ where: { prefix, revoked_at: IsNull() } });
  if (!row) return null;
  const ok = await bcrypt.compare(plaintext, row.token_hash);
  if (!ok) return null;
  await this.repo.update(row.id, { last_used_at: new Date() });
  return row.user_id;
}
```

### Phase 3 — Backend: bot-команды `/mcp_token`, `/mcp_tokens`, `/mcp_token_revoke`

- **3.1** `alfy-bot/src/modules/bot/bot.update.ts` (modify, near `@Start()`/existing commands)
  - `@Command('mcp_token') async issueToken(@Ctx() ctx)` — парсит arg как имя; находит пользователя через `authService.findOrCreateTelegramUser`; вызывает `apiTokenService.generate(user.id, name)`; отправляет в чат: «Сохрани токен — он показан один раз: `<plaintext>`».
  - `@Command('mcp_tokens') async listTokens(@Ctx() ctx)` — `apiTokenService.list(user.id)` → форматирует список с last_used_at.
  - `@Command('mcp_token_revoke') async revokeToken(@Ctx() ctx)` — арг = id; `apiTokenService.revoke(id, user.id)`.
- **3.2** `alfy-bot/src/modules/bot/bot.module.ts:9-16` (modify) — добавить `AuthModule` в `imports` (уже есть) для `ApiTokenService` (export'нут в Phase 2.6).
- **3.3** Tests (light — TDD-yes но через mock telegraf-context):
  - `bot.update.spec.ts` — если файла нет, создаём; тесты на парсинг arg и вызов сервиса с правильными параметрами. Не дёргаем реальный telegraf API.
- Invariant: «plaintext показывается один раз» — только в `issueToken` ответе, нигде не логируется.
- Commit: `feat(bot): команды /mcp_token{,s,_revoke} для MCP-доступа`

### Phase 4 — alfy-mcp package: scaffold + transports + REST client

- **4.1** `alfy-mcp/package.json` (create)
  - `"type": "module"`, deps: `@modelcontextprotocol/sdk`, `axios`, `commander` (или `node:util.parseArgs`); devDeps: `tsx`, `typescript`, `vitest`, `eslint`, `@types/node`.
  - Scripts: `dev:stdio`, `dev:http`, `build`, `start`, `test`, `lint`.
- **4.2** `alfy-mcp/tsconfig.json`, `eslint.config.js`, `vitest.config.ts` (create) — стандартные ESM.
- **4.3** `alfy-mcp/src/config.ts` (create)
  - Читает env: `ALFY_API_BASE` (default `http://localhost:3002/api`), `ALFY_API_TOKEN` (опц.), `MCP_HTTP_PORT` (default `3003`).
  - `getToken(req?: IncomingMessage): string` — header `Authorization` если есть, иначе env. Throw `UnauthorizedError` если нигде нет.
- **4.4** `alfy-mcp/src/rest-client.ts` (create)
  - `class AlfyRestClient { constructor(base: string, token: string); get(path), post(path, body), patch(path, body), del(path) }`.
  - Прокидывает `Authorization: Bearer <token>`. На 4xx/5xx бросает `RestError(status, message, body)`.
  - **Тесты:** mock-axios (vitest), проверяем формирование заголовков, маршалинг ошибок.
- **4.5** `alfy-mcp/src/cli.ts` (create, entry)
  - Парсит `--stdio` | `--http`. Создаёт сервер из `src/server.ts`, подключает выбранный транспорт.
- **4.6** `alfy-mcp/src/server.ts` (create)
  - `function createServer(): McpServer` — фабрика, регистрирует все tools (из `src/tools/`).
- **4.7** `alfy-mcp/src/transports/stdio.ts` (create) — стандартный `StdioServerTransport` из SDK. Логи в stderr.
- **4.8** `alfy-mcp/src/transports/http.ts` (create)
  - Express или native `http` сервер. SSE endpoint `/sse`. Per-request: извлекает bearer header, создаёт scoped `AlfyRestClient`, проксирует в McpServer-handler.
- Invariant: «MCP не ходит в БД» — `rest-client.ts` единственный outbound HTTP. «stdout зарезервирован под протокол» — все логи через `console.error` или pino-в-stderr.
- Commit: `feat(mcp): scaffold пакета alfy-mcp — CLI, REST client, stdio+HTTP транспорты`

### Phase 5 — alfy-mcp tools + Docker + Caddy

- **5.1** `alfy-mcp/src/tools/goals.ts` (create) — pure schemas (zod) + handler factory.
  - `list_goals({ status?: 'active'|'completed'|'archived' })` → `GET /goals?status=`.
  - `get_goal({ id })` → `GET /goals/:id`.
  - `create_goal({ goal_name, ... })` → `POST /goals`.
  - `add_questions_to_goal({ goal_id, questions: [...] })` → `POST /goals/:id/questions`.
  - `update_goal({ id, name?, status? })` → `PATCH /goals/:id`.
- **5.2** `alfy-mcp/src/tools/tasks.ts` (create)
  - `list_tasks({ project_id?, status?, due_from?, due_to? })` — пост-фильтр в JS (REST отдаёт `/tasks`).
  - `get_task({ id })` — через `list_tasks().find`, либо если `GET /tasks/:id` — прямо. *Open question*: есть ли GET single task. Если нет — фильтр in-memory.
  - `create_task`, `update_task`, `complete_task` (→ `PATCH /tasks/:id` с `completed_at`), `delete_task`.
- **5.3** `alfy-mcp/src/tools/questions.ts` (create)
  - `list_habits`, `get_question`, `create_habit`, `update_habit`, `update_habit_schedule`, `delete_habit`, `answer_question` (→ `POST /questions/:id/answers` из Phase 1), `get_question_analytics`.
- **5.4** `alfy-mcp/src/lib/progress-aggregator.ts` (create, pure)
  - `aggregate(goals, tasksByPeriod, analyticsByGoal): ProgressReport` — pure function. **TDD: фикстуры → ожидаемый shape**.
- **5.5** `alfy-mcp/src/tools/progress.ts` (create)
  - `get_progress({ period: 'today'|'week' })` — параллельно 3 fetch'а (list_goals, list_tasks, analytics на каждый активный вопрос); передаёт в `progress-aggregator`.
- **5.6** `alfy-mcp/Dockerfile` (create) — multi-stage Node 22 alpine. Entrypoint: `node dist/cli.js --http`.
- **5.7** `docker-compose.yml` (modify) — добавить service `alfy-mcp` (внутр. порт 3003, env `ALFY_API_BASE=http://alfy-bot:3002/api`).
- **5.8** `Caddyfile` (modify) — добавить блок для `tracker.rocketup.tech`: `handle_path /mcp/* { reverse_proxy alfy-mcp:3003 { flush_interval -1 } }` (flush_interval для SSE).
- **5.9** `alfy-mcp/README.md` (create) — как сгенерировать токен в боте, как подключить из Claude Desktop (`mcpServers: { alfy: { command: "npx", args: ["-y", "alfy-mcp", "--stdio"], env: { ALFY_API_TOKEN, ALFY_API_BASE } } }`).
- **5.10** Tests (RED first):
  - per tool: mock REST client → проверяем URL, метод, тело и shape ответа.
  - `progress-aggregator.spec.ts` — pure tests с 3-4 фикстурами (нет ответов, частично, всё закрыто, streak ломается).
- Invariant: «tool-handler ≤ 1 HTTP-вызов» — кроме `get_progress` (3 параллельных, как заявлено в Design). «Не плодим endpoint'ы» — progress только в MCP.
- Commit: `feat(mcp): MCP tools + Docker/Caddy интеграция`

### Test strategy

| Phase | RED-first tests | Tooling |
|---|---|---|
| 1 | `question.controller.spec.ts` — POST :id/answers happy + 400 invalid | jest + supertest |
| 2 | `api-token.service.spec.ts`, `api-token-auth.guard.spec.ts`, `jwt-or-api-token.guard.spec.ts` | jest, in-memory sqlite или mock-repo |
| 3 | `bot.update.spec.ts` — mock telegraf ctx | jest |
| 4 | `rest-client.spec.ts` (mock axios), `config.spec.ts` (env parsing) | vitest |
| 5 | per-tool spec, `progress-aggregator.spec.ts` (фикстуры) | vitest |

### Order & dependencies

- Phase 1 → независима.
- Phase 2 → независима от 1.
- Phase 3 → нужен 2 (использует `ApiTokenService`).
- Phase 4 → нужны 1+2 (REST endpoints + token auth готовы; иначе MCP не запустится against реальный backend).
- Phase 5 → нужен 4 (scaffold) и желательно 1-3 (для end-to-end smoke).
- Параллелизация: 1 и 2 можно делать одновременно; 4 можно начать когда 2 в середине (token guard готов).

### Backwards compatibility

- Phase 1: новый endpoint, не ломает.
- Phase 2 (2.8): замена `JwtAuthGuard` на `JwtOrApiTokenGuard` в 4 контроллерах — **должна быть прозрачной** для существующих JWT-клиентов (composite guard диспетчит). Тесты `jwt-or-api-token.guard.spec.ts` это покрывают.
- Phase 3: новые команды бота, не конфликтуют.
- Phase 4-5: новый пакет, новый docker-service, новая Caddy-route — аддитивно.

### Open questions / risks

- **OQ-1:** есть ли `GET /tasks/:id` отдельным endpoint'ом? Если нет — `get_task` через filter из `GET /tasks`. *Проверить в Phase 5.2*.
- **OQ-2:** `@modelcontextprotocol/sdk` — какой именно package name (есть несколько форков). *Проверить в Phase 4.1*; вероятно официальный `@modelcontextprotocol/sdk`.
- **R-1:** SSE через Caddy требует `flush_interval -1`. Если в Caddy v2 синтаксис отличается — поправить в Phase 5.8.
- **R-2:** ESM-only пакет может конфликтовать если `alfy-bot` пытается импортировать что-то из alfy-mcp. Не делаем — границы строгие.
- **Rollback:** все коммиты по фазам, каждый легко `git revert`. Phase 2.8 (замена guard) — единственный места, требующий тщательного теста перед merge.

## Verify

**Result:** passed

Positive:
- backend test suite (`alfy-bot npm test`) — 243 passed
- mcp test suite (`alfy-mcp npm test`) — 110 passed (7 файлов)
- mcp TypeScript build (`npm run build`) — clean
- MCP stdio boot + `initialize` + `tools/list` → 20 tools зарегистрированы (goals 5 + tasks 6 + questions 8 + progress 1)
- POST /:id/answers happy path + invalid date + too-long answer (spec)
- ApiToken generate / verify / list / revoke (spec)
- JwtOrApiTokenGuard диспетчинг по формату (spec)
- Bot commands `/mcp_token{,s,_revoke}` — парсинг args + ветки missing/invalid/NotFound (spec)
- progress-aggregator pure: empty / partial / fully-answered / mixed-task-status фикстуры (spec)

Negative:
- CLI без флагов → `Usage: alfy-mcp --stdio | --http`, exit 2
- Invalid/revoked token → 401 (spec)
- Revoke nonexistent → 404 (spec)
- Tools формат REST-ошибок (4xx/5xx → RestError, без silent fallback) (spec)

Invariants:
- MCP не ходит в БД: нет typeorm/sqlite импортов в `alfy-mcp/src` (grep пуст)
- stdout reserved: нет `console.log` в `alfy-mcp/src`; runtime подтвердил — на stdout только JSON-RPC, диагностика в stderr
- `bot/scenes/report.scene.ts` НЕ тронут (git diff main..feat/alfy-mcp пуст для файла)
- Новые БД-сущности — только `ApiToken` (diff `shared/entities/` показывает только api-token.entity.ts + barrel-export)
- Tool handler ≤1 HTTP-вызов: goals 5/5, tasks 6/6, questions 8/8; progress — 3 параллельных через Promise.all (исключение по плану)

Smoke: `printf 'initialize\ntools/list' | ALFY_API_TOKEN=fake node dist/cli.js --stdio` → 20 tools listed, stderr `[alfy-mcp] stdio transport connected`

Notes: `alfy-bot/src/app.controller.spec.ts` — 1 pre-existing fail (baseline на origin/main, baseline-fix был ревёрнут per system-reminder, не относится к scope этой задачи). Прочая 243-зелёная база backend подтверждает что замена `JwtAuthGuard → JwtOrApiTokenGuard` не сломала существующие JWT-clients (backwards-compat OK).

## Conclusion

Outcome: MCP-сервер для Alfy: новый пакет `alfy-mcp/` (stdio + Streamable HTTP), 20 tools поверх REST `alfy-bot`, API-токены через бот (`/mcp_token{,s,_revoke}`), composite `JwtOrApiTokenGuard`. HEAD `923c2ad`.

Invariants:
- MCP не ходит в БД — verified grep'ом: нет typeorm/sqlite импортов в `alfy-mcp/src`.
- `ApiToken.token_hash` единственное представление — plaintext возвращается только из `generate()`, нигде не логируется.
- `bot/scenes/report.scene.ts` не тронут — diff main..HEAD пуст для файла.
- Tool-handler ≤1 HTTP-вызов — goals 5/5, tasks 6/6, questions 8/8; `get_progress` — 3 параллельных по плану.
- stdout зарезервирован под протокол — runtime smoke подтвердил, нет `console.log` в `src/`.
- Новые таблицы только `api_token` — diff `shared/entities/` показал только `api-token.entity.ts` + barrel.

### Deviations from plan

- **Phase 1.3** — `ReportModule` уже был в `QuestionModule.imports`.
- **Phase 2** — prettier auto-formatted `add-questions.dto.ts` и `create-goal.dto.ts` (формат-only).
- **Phase 4.6–4.8** — `McpServer` + `StreamableHTTPServerTransport` вместо deprecated `Server` + `SSEServerTransport`. HTTP endpoint `/mcp` вместо `/sse`.
- **Phase 5.6** — `startHttpTransport(config)` без pre-built server; `createServer(client)` теперь требует клиента (per-request token).
- **Phase 5.4 streak** — день засчитывается, только если все запланированные вопросы цели отвечены.

### Review findings

- **Critical 1 — Task ID type mismatch.** `Task.id: string` (uuid) в бэке vs `TaskItem.id: number` в MCP → 5 tool'ов получали 404. Resolved в `923c2ad`: схемы → `z.string().uuid()`, `TaskItem.id` и `TaskSummary.id` → `string`, фикстуры тестов переписаны на UUID.
- **Critical 2 — Missing ownership in `addAnswer`.** Любой authenticated мог отвечать на чужие вопросы по ID. Resolved в `923c2ad`: добавлен goal-ownership check + переход на `NotFoundException`/`ForbiddenException`; +2 теста на отказ при чужой/отсутствующей цели.
- **Important — Caddy `/mcp/*` не матчит bare `/mcp`.** Endpoint MCP HTTP именно `/mcp` (без слеша). Resolved в `923c2ad`: `handle /mcp /mcp/*`.

### Future work

- **Project/push-subscription контроллеры** под чистым `JwtAuthGuard` — если scope MCP расширится на проекты, нужен такой же `JwtOrApiTokenGuard`-апдейт (Phase 2.8 явно ограничивал scope).
- **`app.controller.spec.ts`** — pre-existing fail на origin/main (test зовёт `getHello()` без mock-req'а), не в scope этой задачи.
