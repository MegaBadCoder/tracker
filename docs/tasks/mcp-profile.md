# MCP в настройках профиля

**Status:** done
**Branch:** codex/mcp-profile
**Worktree:** /Users/v/projects/Alfy/.worktrees/mcp-profile
**Goal:** Пользователь создаёт токен в настройках, подключает своего агента по инструкции, читает свои задачи через MCP и после отзыва токена теряет доступ с этим токеном.
**Mode:** interactive

## Context
- База — актуальный remote main `607eb9bb9e5ed088ba3ef8489f1dcb4d795fdaf3`; пользователь подтвердил main вместо develop.
- `ApiTokenService` уже создаёт именованные токены, хранит bcrypt-хеш, возвращает список метаданных и отзывает токен с проверкой владельца. Сейчас выдача доступна через Telegram-бота.
- `SettingsView.vue` содержит настройки аккаунта; HTTP MCP принимает Bearer-токен на `/mcp`.
- Рабочая копия изолирована от незакоммиченных изменений исходного checkout. Зависимости ещё не установлены, проверки не запускались.

## Design
Дизайн, цель и план согласованы пользователем; разрешён автоапрув плана.

Секция «MCP и агенты» в настройках с созданием именованного токена, однократным показом секрета и кнопкой копирования. Список содержит имя, префикс, дату создания и последнего использования; отзыв требует явного подтверждения в интерфейсе. Сообщение поясняет, что агент получает доступ к данным пользователя, включая изменения.

Добавить JWT-защищённые REST-методы создания, списка и отзыва поверх существующего `ApiTokenService`. Новых таблиц и отдельной системы авторизации не требуется. Управление токенами недоступно по MCP/API-токену. Команды Telegram и существующие токены продолжают работать.

Инструкция рядом с токенами: подключение по Streamable HTTP, адрес сервера, Bearer-авторизация и копируемые примеры для Codex, Claude Code и универсального клиента. Конфигурации используют placeholder токена; секрет копируется отдельной кнопкой. URL определяется единообразно для окружения; поддержать явный адрес MCP для локальной разработки.

Альтернативы: ссылка на команды Telegram требует перехода в бот и не обеспечивает выдачу на клиенте; отдельные OAuth/scopes расширяют задачу и требуют новой модели доступа. Рекомендуется существующий механизм токенов и небольшой REST/UI слой.

TDD: yes — контракты REST, права владельца и отказ доступа после отзыва; внешний вид проверяется в браузере.

### Invariants
- IV1 — Пользователь видит и отзывает только свои токены; userId берётся из JWT.
- IV2 — Plaintext возвращается только при создании, не записывается в постоянное хранилище браузера, URL или логи; список не содержит секрет или хеш.
- IV3 — Отозванный токен больше не позволяет читать или изменять данные через MCP.
- IV4 — Ошибки создания, загрузки, отзыва и копирования отображаются пользователю; повторная отправка блокируется на время запроса.

### Assumptions
- AS1 — Сохраняется существующая модель прав API-токена без сроков действия и scopes.

### Unknowns
- UK1 — Проверить актуальный синтаксис конфигураций клиентов по официальной документации при подготовке инструкций.

## Plan
Переиспользовать `ApiTokenService`, JWT guard, общий axios-клиент и существующий ConfirmDialog. Две фазы без миграций и изменений протокола MCP; файлы новых модулей указаны с начальной строкой `:1`.

### PH1 — API управления токенами
- `alfy-bot/src/modules/auth/api-tokens.controller.ts:1` (create): `ApiTokensController.create(req, dto)`, `list(req)`, `revoke(req, id)` — маршруты IF1, JWT-only guard, числовой ID, `Cache-Control: no-store`; делегирование существующему сервису с `req.user.sub` (IV1–IV3, AS1).
- `alfy-bot/src/modules/auth/dto/create-api-token.dto.ts:1` (create): `CreateApiTokenDto.name: string` — trim и длина 1–100 символов; не принимать userId из тела.
- `alfy-bot/src/modules/auth/auth.module.ts:6-39` (modify): регистрация нового контроллера, без изменений сервисов и Telegram-команд.
- `alfy-bot/test/api-tokens.e2e-spec.ts:1` (create): failing tests перед реализацией через существующий `createTestApp`; создание, whitelist ответа, список только своих токенов, чужой/повторный отзыв, невалидное имя/ID, отказ без JWT и с API-токеном на всех методах; API-токен читает задачи до отзыва и получает 401 после него.
- Commit: `feat(auth): expose profile token management API`.

### PH2 — Настройки и подключение агентов
- `alfy-bot-frontend/src/features/mcp/api/tokens.ts:1` (create): `listTokens(): Promise<McpToken[]>`, `createToken(name: string): Promise<CreatedMcpToken>`, `revokeToken(id: number): Promise<void>` через существующий `api` (IF1).
- `alfy-bot-frontend/src/features/mcp/model/types.ts:1` (create): типы ответов IF1.
- `alfy-bot-frontend/src/features/mcp/model/useMcpTokens.ts:1` (create): локальное состояние списка и однократно показанного секрета, независимые ошибки загрузки/создания/отзыва, блокировка повторных команд; успешная выдача не теряет секрет при ошибке обновления списка (IV2, IV4).
- `alfy-bot-frontend/src/features/mcp/ui/McpSettings.vue:1` (create): именованная форма, копирование секрета, список и ConfirmDialog отзыва; ошибки clipboard и возможность вручную скопировать текст; очищать показанный секрет после его отзыва.
- `alfy-bot-frontend/src/features/mcp/ui/McpConnectionGuide.vue:1` (create): адрес, инструкции и копируемые конфигурации без реального секрета; проверить синтаксис Codex и Claude Code по официальным источникам (UK1).
- `alfy-bot-frontend/src/features/mcp/lib/connection-guide.ts:1` (create): `resolveMcpUrl(override: string | undefined, origin: string): string`, `buildConnectionGuide(url: string): ConnectionGuide`; явный `VITE_MCP_URL` имеет приоритет, иначе `/mcp` на текущем origin. Передавать окружение из UI, а не читать его внутри функций (GPC1).
- `alfy-bot-frontend/src/views/SettingsView.vue:164-180` (modify): импорт и размещение секции.
- `alfy-bot-frontend/.env.example:1-2`, `alfy-bot-frontend/src/vite-env.d.ts:1` (modify): локальный `VITE_MCP_URL=http://localhost:3003/mcp` и тип конфигурации; production same-origin работает без новой настройки сборки.
- `alfy-bot-frontend/tests/features/mcp/McpSettings.spec.ts:1`, `alfy-bot-frontend/tests/features/mcp/connection-guide.spec.ts:1` (create): выдача/однократность/отзыв/ошибки/повторные клики, отсутствие секрета в storage и инструкциях, адреса и экранирование конфигураций; failing tests для детерминированных контрактов перед реализацией.
- `alfy-bot-frontend/tests/views/SettingsView.spec.ts:1-40` (modify): проверка встраивания секции с изолированным мокированием API.
- `alfy-mcp/README.md:7-42`, `CLAUDE.md:11-60` (modify): получение и отзыв через настройки, подключение по HTTP; сохранять поддержку Telegram и stdio. `README.md` проверить на необходимость правок после реализации.
- Commit: `feat(settings): add MCP tokens and agent setup guide`.

### Interfaces
- IF1 — JWT-only `/api/auth/api-tokens`: GET → `McpToken[]`; POST `{ name: string }` → 201 `{ id: number, plaintext: string }`; DELETE `/:id` → 204. `McpToken = { id: number; name: string; prefix: string; created_at: string; last_used_at: string | null }`; даты ISO 8601. Валидация → 400, отсутствие JWT → 401, чужой или уже отозванный ID → 404.

### Interface graph
- PH1 -> IF1 @ alfy-bot/src/modules/auth/api-tokens.controller.ts, alfy-bot/src/modules/auth/dto/create-api-token.dto.ts, alfy-bot/src/modules/auth/auth.module.ts, alfy-bot/test/api-tokens.e2e-spec.ts
- PH2 IF1 -> @ alfy-bot-frontend/src/features/mcp/, alfy-bot-frontend/src/views/SettingsView.vue, alfy-bot-frontend/src/vite-env.d.ts, alfy-bot-frontend/.env.example, alfy-bot-frontend/tests/features/mcp/, alfy-bot-frontend/tests/views/SettingsView.spec.ts, alfy-mcp/README.md, CLAUDE.md

### Проверки и риски
- Установить зависимости по lockfile отдельно в worktree; сначала baseline существующих auth/token и SettingsView тестов, затем RED/GREEN новых контрактов, связанные тесты и сборки backend/frontend.
- Сквозной сценарий из Verify обязателен дополнительно к unit/e2e API; проверить UI на мобильной и настольной ширине. Реальные внешние приложения агентов не считать проверенными по одному только MCP SDK.
- RK1 — Потерянный ответ выдачи нельзя восстановить из хеша: не делать автоматический retry POST; после сетевой ошибки предложить обновить список и отозвать лишний токен.
- RK2 — Неверный адрес окружения ломает подключение: тестировать same-origin и явный локальный URL, неподдерживаемый URL показывать как ошибку конфигурации.
- Совместимость: только добавление REST/UI; формат токенов и команды бота неизменны. Откат — revert двух commits, существующие данные токенов остаются пригодны для бота.

## Verify
Result: passed.
- CK1 (IV1, IF1) — чужой/повторный отзыв, список владельца, отсутствие JWT и API-токен вместо JWT — held: свежий `npm run test:e2e -- --runInBand api-tokens.e2e-spec.ts`, 14/14.
- CK2 (IV2) — plaintext в списке/после перезагрузки — held: whitelist e2e и реальная перезагрузка браузера; копирование показало успешный статус, секрет исчез после reload.
- CK3 (IV3) — отзыв не закрывает MCP-доступ — held: созданный в браузере токен прочитал `MCP profile smoke task` через SDK/Streamable HTTP; после отзыва через ConfirmDialog тот же `list_tasks` вернул `isError: true`, `REST 401: Unauthorized`.
- CK4 (IV4) — ошибка обновления списка теряет токен, clipboard failure, повторный submit — held: свежие 17/17 frontend tests; конкурирующие refresh/mutations заблокированы.
- CK5 (UK1) — конфигурации расходятся с клиентами — held: проверены официальные https://developers.openai.com/learn/docs-mcp и https://docs.anthropic.com/en/docs/claude-code/mcp ; URL/escaping проверены тестами. Нативные приложения Codex/Claude Code не запускались; реальный MCP-протокол проверен SDK.
- CK6 — мобильная страница переполняется — held: браузер 390×844, scrollWidth=clientWidth=379; проверен desktop и сохранён screenshot.
- Сборки backend/frontend/MCP прошли; 20 существующих auth-тестов, 7 story-sprint e2e и 152 MCP-теста прошли.
Smoke: браузер `localhost:5178/settings` → тестовая БД в памяти на 3302 → MCP на 3303 → успешное чтение → отзыв → отказ; цель наблюдалась полностью на локальном окружении.
Notes: backend `npm ci` не проходит из-за существующего рассогласования lockfile (encoding); зависимости установлены локально через `npm install --package-lock=false`, lockfile не изменён. Общий frontend lint сообщил 2047 проблем; сравнение с чистым baseline не выполнялось; ESLint новых файлов и typecheck прошли. Временный стенд требовал CORS до app.init; production-код для этого не менялся.

## Execution
- [x] PH1 — API управления токенами: `12950d3`.
- [x] PH2 — настройки и инструкции: `84333db`.

## Conclusion
Цель достигнута на локальном окружении: выдача в браузере → чтение через MCP SDK → отзыв в браузере → отказ доступа. Итоговый код `49a083e`; ветка не опубликована и не слита.
- IV1–IV4 — подтверждены CK1–CK4; AS1 сохранена без изменений модели токенов.
- UK1 закрыт: примеры сверены с официальными источниками, Claude Code использует `${ALFY_MCP_TOKEN}` в `.mcp.json`. Нативные приложения агентов не запускались; проверен реальный HTTP MCP-клиент SDK.
- Независимое ревью выявило сохранение токена в shell history при ручной подстановке в команду; исправлено в `49a083e`. Повторное ревью не выявило замечаний высокой уверенности. Регрессионный тест сначала упал на старом формате команды, затем прошёл на JSON; скрытый ввод и экспорт проверены в Bash/Zsh.
- Проверки после исправления: 17 frontend-тестов и build прошли, scoped lint прошёл; повторный просмотр браузера подтвердил итоговые инструкции.

### Deviations from plan
- Вместо CLI-команды Claude Code показан фрагмент `.mcp.json` со ссылкой на переменную окружения: исключена вставка секрета в историю shell и аргументы процесса установки.
- Использована `.tmp/` вместо `tmp/` для проверочного стенда: этот каталог уже игнорируется репозиторием. Стенд и временные секреты удаляются после проверки.
