# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Repository layout

Монорепо из трёх приложений + общая инфраструктура:

- `alfy-bot/` — NestJS-бэкенд (порт 3002): REST API под `/api`, Swagger на `/api/docs`, Telegram-бот (telegraf), TypeORM + SQLite (`data/database.sqlite`, `synchronize: true`), JWT + API-token auth (`JwtOrApiTokenGuard`), web-push.
- `alfy-bot-frontend/` — Vue 3 + Vite + TS + Tailwind v4 + Pinia + vue-router. PWA (`vite-plugin-pwa`, кастомный `sw.ts`). Запускается как обычный SPA и как Telegram WebApp.
- `alfy-mcp/` — MCP-сервер (порт 3003, ESM, Node 22+): тонкая обёртка над REST `alfy-bot` для Claude Desktop/Code и удалённых MCP-клиентов. Транспорты: stdio + Streamable HTTP (endpoint `/mcp`). Auth — API-токены, выдаваемые ботом (`/mcp_token <name>`). Не ходит в БД напрямую.
- `docker-compose.yml` + `Caddyfile` — прод: Caddy на 80/443 раздаёт `tracker.rocketup.tech`, проксирует `/api/*` на backend, `/mcp` + `/mcp/*` на alfy-mcp, остальное на frontend (nginx).
- `scripts/tunnels.sh` — Cloudflare Quick Tunnels для dev (см. README).

Все три деплоятся независимо в Docker-реестр (`REGISTRY_URL` в `.env`).

# Commands

## Backend (`alfy-bot/`)

```bash
npm run start:dev           # nest start --watch (порт 3002)
npm run build               # nest build → dist/
npm run lint                # eslint --fix
npm run test                # jest (все *.spec.ts)
npm run test:watch
npm run test:cov
npm run test:e2e            # jest --config ./test/jest-e2e.json
npx jest path/to/file.spec.ts                   # один файл
npx jest -t "имя теста"                          # один тест по имени
```

Jest сконфигурирован в `package.json` (`rootDir: src`, `testRegex: .*\.spec\.ts$`, `ts-jest`).

## Frontend (`alfy-bot-frontend/`)

```bash
npm run dev                 # vite (порт 5173)
npm run build               # vue-tsc -b && vite build
npm run lint                # eslint .
npm run test                # vitest (watch)
npm run test:run            # vitest run (CI)
npx vitest run path/to/file.spec.ts             # один файл
npx vitest -t "имя теста"                        # один тест
npx vue-tsc --noEmit -p tsconfig.app.json       # тип-чек без билда
```

Тесты лежат в `alfy-bot-frontend/tests/` (зеркалят структуру `src/`), env — `happy-dom`, MSW для моков сети.

## MCP server (`alfy-mcp/`)

```bash
npm run dev:stdio           # tsx src/cli.ts --stdio (для Claude Desktop/Code)
npm run dev:http            # tsx src/cli.ts --http (порт 3003, endpoint /mcp)
npm run build               # tsc → dist/
npm run test                # vitest run
npm run lint                # eslint .
```

ESM-пакет, Node 22+. SDK — `@modelcontextprotocol/sdk` (`McpServer` + `StreamableHTTPServerTransport`). Auth — API-токены через бот (`/mcp_token <name>`), хранятся как bcrypt-хеш + 10-char prefix-index в БД (`api_token` entity). Tools — тонкая обёртка над REST `alfy-bot` (1 HTTP-вызов на tool, кроме `get_progress` — 3 параллельных). См. `alfy-mcp/README.md` для подключения из клиентов.

## Dev (Telegram WebApp через публичные URL)

```bash
./scripts/tunnels.sh        # cloudflared, обновляет alfy-bot/.env (WEBAPP_URL) и alfy-bot-frontend/.env (VITE_API_URL)
```

Перед запуском должны быть подняты vite (5173) и nest (3002). После — перезапустить бот и фронт.

# Backend architecture (Clean Architecture per module)

Каждый бизнес-модуль в `alfy-bot/src/modules/<name>/` следует трёхслойной структуре:

- `domain/` — порты (абстрактные классы как DI-токены: `*Port`), чистые утилиты без зависимостей фреймворка. Пример: `task/domain/task-repository.port.ts`, `task/domain/recurrence.utils.ts`.
- `infrastructure/` — реализации портов (TypeORM-репозитории, адаптеры внешних сервисов, schedulers). Пример: `task/infrastructure/typeorm-task.repository.ts`, `composite-notification.adapter.ts`.
- `application/` или модульные сервисы (`task.service.ts`) — оркестрация, зависят только от портов.
- `dto/` — class-validator DTO для контроллеров.
- Корень модуля: `*.controller.ts`, `*.module.ts`, `*.service.ts`.

Биндинги портов делаются в `*.module.ts` через `{ provide: SomePort, useClass: SomeAdapter }` — см. [alfy-bot/src/modules/task/task.module.ts](alfy-bot/src/modules/task/task.module.ts). Сервисы запрашивают `*Port` в конструкторе, а не конкретные классы.

Сущности TypeORM собраны в `alfy-bot/src/shared/entities/` (один общий barrel `index.ts`) и регистрируются разом в `app.module.ts`. Миграции данных — отдельные `*MigrationService` в `shared/database/`, подключаются как providers в `AppModule`.

`shared/` — кросс-модульный код (entities, validators, services, утилиты). `SharedModule` экспортирует общие провайдеры.

Глобально включены: `ValidationPipe({ whitelist: true, transform: true })`, префикс `/api`, CORS только для `localhost`, Swagger Bearer auth.

**Route-коллизии под общим префиксом.** Несколько контроллеров могут делить один префикс (например `@Controller('goals')` в `GoalModule` и в `ReportModule`). Тогда `@Get(':id')` одного контроллера перехватывает одиночный литерал (`goals/report-queue`) другого, и `ParseIntPipe` отдаёт 400. Порядок матчинга = import-порядку модулей в `AppModule` — полагаться на него хрупко. Express 5 / path-to-regexp v8 **не поддерживают** inline-regex `:id(\d+)` (приложение не стартует). Решение: давать литеральным маршрутам **многосегментный** путь, который одиночный `:id` не может захватить (`goals/reports/queue`, не `goals/report-queue`). Регрессия — `alfy-bot/test/web-goal-reports-routing.e2e-spec.ts`.

# Frontend architecture (FSD-like)

`alfy-bot-frontend/src/` устроен как feature-sliced:

- `features/<name>/{api,lib,model,ui}/` — самодостаточные фичи: `tasks`, `calendar`, `projects`, `task-timer`, `goals`. `model/` обычно содержит Pinia-стор и типы (для `goals` — composable state-машины создания), `lib/` — чистые утилиты, `ui/` — Vue-компоненты, `api/` — HTTP-клиенты для бэка.
- `components/ui/` — shadcn-vue примитивы (см. ниже).
- `components/` (корень) — общие layout/виджеты (`AppLayout`, `AppHeader`, `AppSidebar`, чарты).
- `views/` — страницы, подключённые в `router/index.ts`.
- `stores/` — глобальные Pinia-сторы (`user-store`).
- `api/` — общий HTTP-клиент: `api/client.ts` (axios инстанс с JWT-интерцептором и редиректом на `/login` по 401), `api/auth.ts`, `api/tokenStorage.ts`.
- `composables/` — реюзабельные composables (`useCooldown`, `usePushSubscription`, ...).
- `mocks/` — MSW-моки для тестов.
- `sw.ts` — кастомный service worker (workbox).

Авторизация: при старте `main.ts` пробует `authorize()` если есть `Telegram.WebApp.initData` или dev-флаг `VITE_DEV_TELEGRAM_ID`. Router guard в `router/index.ts` редиректит на `/login` любой не-public маршрут при отсутствии токена. Public-маршруты помечены `meta: { public: true }`.

## Drag-and-drop (две системы — выбирать по контексту)

В кодбазе сосуществуют два независимых DnD-стека. Не смешивать.

- **Кастомный движок на PointerEvents** в `features/tasks/lib/dnd/` (`useTaskDnd`, `useDragSource`, `useDropTarget`, `useReorderList`) + `<TaskDragGhost />` через teleport в `App.vue`. Используется для: reorder задач в Inbox (`TasksView`) и в проекте-list-без-колонок (`ProjectView` когда `columns.length === 0`), drop задач на проекты/Inbox в сайдбаре. Жесты: drag-handle (немедленно) + long-press 350ms на mobile + threshold 5px на desktop.
- **`vuedraggable`** в `features/projects/ui/BoardView.vue`, `BoardColumn.vue`, `ProjectTreeNav.vue`. Используется для: задач внутри колонок board-view, переупорядочивания самих колонок, переупорядочивания проектов в сайдбаре. Не трогать без явной задачи.
- **Drag-create в календаре** — `features/calendar/lib/use-create-slot-drag.ts` (рисование задачи по сетке часов). Использует те же константы (`LONG_PRESS_DELAY_MS=350`, `TOUCH_DRAG_THRESHOLD_PX=8`), что и `features/tasks/lib/dnd/use-drag-source.ts`, чтобы на mobile сохранять нативный scroll до осознанного long-press. На desktop drag стартует мгновенно.

# UI conventions — shadcn-vue

При работе с Vue UI (особенно `alfy-bot-frontend`) источник истины — `https://www.shadcn-vue.com/`, **не React-докс**.

Перед созданием нового UI-компонента:

1. Проверить `alfy-bot-frontend/src/components/ui/` — возможно уже есть.
2. Переиспользовать или расширить существующий.
3. Если нет — реализовать в стиле shadcn-vue репозитория.

Контекст:

- `alfy-bot-frontend/components.json` — каноничный shadcn config (`style: new-york`, `baseColor: neutral`, `iconLibrary: lucide`).
- Алиасы: `@/components`, `@/lib/utils` (`cn` для merge классов), `@/components/ui`, `@/lib`.
- Стек: Vue 3 `<script setup>` + TS + Tailwind v4 + reka-ui (примитивы под капотом shadcn-vue).
- Не добавлять брендинг-комментарии и AI-маркеры.

# Timezone conventions

Все операции с датой/временем уважают `User.timezone` (IANA, например `"Europe/Moscow"`).

## Backend (`alfy-bot`)

- В БД даты хранятся как **UTC**.
- Доменные функции (`recurrence.utils.ts`) работают с UTC-методами (`getUTCDay`, `setUTCDate`) и должны оставаться timezone-agnostic.
- Перед вызовом доменных функций — сдвинуть UTC к wall clock пользователя через `shiftToUserWallClock(date, timezone)` из [alfy-bot/src/modules/task/lib/timezone.ts](alfy-bot/src/modules/task/lib/timezone.ts).
- После — обратно через `shiftBackToUtc(date, timezone)`.
- Таймзону получать через `UserSettingsPort.getTimezone(userId)` — узкий порт, инжектится в сервисы.

## Frontend (`alfy-bot-frontend`)

- Локальное время браузера = таймзона пользователя.
- Утилиты дат (`recurrence.ts`, `dateTime.ts`) используют локальные методы (`getDay`, `setDate`), не UTC.
- Календарь и виртуальные проекции считаются в локальном времени — никаких явных конверсий.

Add as a new top-level ## Workflow Discipline section near the top of CLAUDE.md\n\n## Workflow Discipline
- When user invokes a new task (e.g. /up:make), START that task immediately. Do NOT divert to finalize or close prior tasks unless explicitly asked.
- Always verify the correct git worktree/branch BEFORE editing files. Run `git branch --show-current` and `pwd` first when working on branch-specific features.
- When user interrupts, STOP and ask what they want instead of continuing the previous plan.
Add as new ## Domain Data Conventions section\n\n## Domain Data Conventions
- Pull status/label strings from API objects (e.g. `status_obj.name`), never hardcode Russian/English status strings like 'Выполнен' or 'Не выполнен'.
- Distinguish template types carefully: orderTemplates vs geometry templates have different shapes — confirm before adding fields like `geometry` or attaching map/click handlers.
- When changing identifier values (e.g. product_code 'ARCHIVE_ORDER' → 'archive'), grep for all existing filter/consumer usages first.
Add as new ## Bug Diagnosis section\n\n## Bug Diagnosis
- Before proposing a CSS/styling fix, reproduce the actual symptom and confirm root cause. State your hypothesis explicitly and ask user to confirm before editing.
- For recurring/scheduled-task logic, ensure next-instance dates are 'on-or-after today', not 'next-by-rule from last completion'.
- Always respond in the language the user is writing in (Russian if they write Russian).