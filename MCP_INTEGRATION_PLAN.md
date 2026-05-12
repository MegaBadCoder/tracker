# MCP integration plan for Alfy

Цель: дать Alfy безопасный, малотокенный доступ к приложению целей/задач, чтобы он мог читать состояние, помогать планировать неделю/день, замечать блокеры и выполнять ограниченные write-действия только там, где это безопасно.

## Решение: MCP поверх существующего REST API

Лучше не начинать с прямого `curl` как основного интерфейса.

`curl` полезен для отладки и smoke-test'ов, но как постоянный интерфейс он хуже:

- каждый раз нужно передавать URL, headers, JWT и JSON-схемы;
- выше риск ошибиться в endpoint/body;
- больше токенов уходит на объяснение HTTP-деталей;
- хуже контролировать права на уровне отдельных действий.

MCP лучше как основной слой:

- короткие именованные tools вместо длинных curl-команд;
- стабильные JSON-схемы входа/выхода;
- можно явно разделить read-only и write tools;
- проще добавить guardrails: подтверждения, allowlist полей, dry-run;
- Alfy сможет вызывать `get_status_summary`, а не собирать контекст руками из 5-10 REST-запросов.

Практичный компромисс: **сначала сделать MCP-сервер как тонкую обёртку над текущим REST API**, а `curl` оставить в документации для проверки.

## Текущее состояние проекта

Монорепо:

- `alfy-bot/` — NestJS backend, REST API под `/api`, JWT auth, Swagger `/api/docs`, TypeORM + SQLite.
- `alfy-bot-frontend/` — Vue 3 frontend.
- Уже есть основные домены: goals, questions/habits, reports/analytics, tasks, projects, checklists, pomodoro/timer.

Полезные существующие REST endpoints:

- `GET /api/goals`
- `GET /api/goals/:id`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `PUT /api/tasks/:id/checklist`
- `GET /api/tasks/timer`
- `PUT /api/tasks/timer`
- `DELETE /api/tasks/timer`
- `GET /api/projects`
- `GET /api/projects/:id`
- `GET /api/questions/habits?days=7|14|30`
- `GET /api/questions/:questionId/analytics`

## MVP scope

Сделать отдельный MCP-процесс/пакет, например:

```text
tracker-mcp/
  package.json
  tsconfig.json
  src/
    index.ts
    tracker-client.ts
    tools/
      goals.ts
      tasks.ts
      projects.ts
      reviews.ts
```

Почему отдельный пакет, а не встраивать в NestJS сразу:

- меньше риска сломать backend;
- можно быстро подключить к OpenClaw как внешний MCP server;
- auth и tool permissions проще держать отдельно;
- потом при желании перенести внутрь backend или сделать официальный internal API.

## Configuration

MCP server должен читать env:

```env
TRACKER_API_BASE_URL=https://tracker.rocketup.tech/api
TRACKER_API_TOKEN=<jwt-or-service-token>
TRACKER_DEFAULT_DAYS=7
```

Для dev:

```env
TRACKER_API_BASE_URL=http://localhost:3002/api
TRACKER_API_TOKEN=<dev-jwt>
```

На первом этапе можно использовать обычный JWT пользователя. Позже лучше сделать отдельный service token с ограниченными правами.

## Tool design

### Read-only tools — первая очередь

#### `tracker_get_status_summary`

Главный малотокенный endpoint для Alfy.

Input:

```json
{
  "days": 7,
  "includeCompletedTasks": false
}
```

Output должен быть компактным:

```json
{
  "goals": [
    {
      "id": 1,
      "name": "Освоить ML",
      "status": "active",
      "start": "2026-05-01",
      "end": "2026-07-24",
      "questionsCount": 3
    }
  ],
  "tasks": {
    "totalOpen": 18,
    "overdue": 2,
    "dueToday": 4,
    "next": [
      {
        "id": "uuid",
        "title": "Разобрать линейную регрессию",
        "priority": "high",
        "dueDate": "2026-05-12T00:00:00.000Z",
        "projectId": "uuid"
      }
    ]
  },
  "habits": [
    {
      "id": 10,
      "question": "Учился ML?",
      "days": 7,
      "completed": 5
    }
  ],
  "timer": {
    "active": false,
    "taskId": null
  },
  "blockers": []
}
```

Задача tool: собрать данные из существующих REST endpoints и вернуть уже сжатый summary, чтобы не тратить токены на сырые списки.

#### `tracker_get_goals`

Input:

```json
{
  "status": "active"
}
```

Обёртка над `GET /api/goals?status=active`.

#### `tracker_get_tasks`

Input:

```json
{
  "status": "open",
  "due": "today",
  "projectId": null,
  "limit": 50
}
```

MCP сам фильтрует результат `GET /api/tasks`, если backend пока не поддерживает query-фильтры.

#### `tracker_get_projects`

Input:

```json
{
  "includeColumns": false
}
```

- `false` → `GET /api/projects`
- `true` → `GET /api/projects/:id` для выбранных/всех проектов, аккуратно с лимитами.

#### `tracker_get_habits`

Input:

```json
{
  "days": 7
}
```

Обёртка над `GET /api/questions/habits?days=7`.

#### `tracker_get_timer`

Input: `{}`

Обёртка над `GET /api/tasks/timer`.

### Safe write tools — вторая очередь

Write tools лучше включать только после read-only MVP и ручной проверки.

#### `tracker_create_task`

Input:

```json
{
  "title": "string",
  "description": "string|null",
  "priority": "high|medium|low|null",
  "dueDate": "ISO|null",
  "projectId": "uuid|null",
  "tags": ["string"]
}
```

Guardrails:

- title обязателен;
- по умолчанию `dryRun: true`, если tool вызывается из не доверенного контекста;
- не создавать больше N задач за один вызов без подтверждения.

#### `tracker_update_task`

Разрешить только ограниченный patch:

```json
{
  "id": "uuid",
  "completed": true,
  "title": "optional string",
  "dueDate": "optional ISO|null",
  "priority": "optional high|medium|low|null"
}
```

Guardrails:

- запретить менять `userId`, `isOverdue`, `recurringParentId`, checklist и pomodoro config;
- checklist/pomodoro — отдельными tools позже.

#### `tracker_add_goal_note`

Сейчас в backend не видно отдельной сущности заметок к цели. Для MVP возможны варианты:

1. добавить `goal_notes` entity/API;
2. временно создавать задачу/вопрос с тегом `goal-note`;
3. отложить до отдельного PR.

Рекомендация: отложить до отдельного PR, чтобы не смешивать MCP transport и изменение доменной модели.

## Review tools — главная ценность для Alfy

Эти tools могут быть read-only и возвращать готовые выводы/сводки.

### `tracker_daily_review_context`

Input:

```json
{
  "date": "2026-05-12"
}
```

Output:

```json
{
  "plannedToday": [],
  "completedToday": [],
  "overdue": [],
  "activeGoals": [],
  "habits": [],
  "timerStats": null,
  "suggestedQuestions": [
    "Что сегодня сильнее всего мешало?",
    "Какая одна задача завтра даст максимум прогресса?"
  ]
}
```

### `tracker_weekly_review_context`

Input:

```json
{
  "weekStart": "2026-05-11"
}
```

Output:

```json
{
  "goalsProgress": [],
  "completedTasks": [],
  "missedTasks": [],
  "habitConsistency": [],
  "focusDistribution": [],
  "blockerCandidates": []
}
```

## Security and permissions

Правила доступа:

- сначала подключить read-only MCP;
- write tools включать отдельно;
- destructive tools (`delete_task`, `delete_project`, `delete_goal`) не добавлять в MVP;
- PR/merge делает только Илья;
- Alfy может предлагать изменения и открывать PR при наличии write-доступа, но не мержит сам.

Токен:

- не хранить JWT в репозитории;
- использовать `.env`, `.env.example` только с именами переменных;
- позже заменить пользовательский JWT на отдельный service token с scope: `read:goals`, `read:tasks`, `write:tasks`.

## Implementation steps

### PR 1 — Plan only

- [x] Добавить этот документ в корень репозитория.

### PR 2 — MCP read-only skeleton

- [ ] Создать `tracker-mcp/` package.
- [ ] Добавить MCP SDK dependency.
- [ ] Добавить `tracker-client.ts` с axios/fetch клиентом.
- [ ] Реализовать tools:
  - `tracker_get_status_summary`
  - `tracker_get_goals`
  - `tracker_get_tasks`
  - `tracker_get_projects`
  - `tracker_get_habits`
  - `tracker_get_timer`
- [ ] Добавить `.env.example`.
- [ ] Добавить README с запуском.

### PR 3 — Summary quality

- [ ] Улучшить `tracker_get_status_summary`:
  - due today;
  - overdue;
  - top priorities;
  - active goals;
  - habit streak/consistency;
  - current timer.
- [ ] Добавить лимиты и компактный формат output.

### PR 4 — Safe write tools

- [ ] `tracker_create_task`
- [ ] `tracker_update_task`
- [ ] опционально `tracker_update_checklist`
- [ ] write guardrails + dry-run mode.

### PR 5 — Better backend support, if needed

Если MCP будет слишком много фильтровать на клиенте, добавить backend endpoints:

- `GET /api/assistant/status-summary`
- `GET /api/tasks?status=&due=&projectId=&limit=`
- `GET /api/assistant/daily-review?date=`
- `GET /api/assistant/weekly-review?weekStart=`

Но это лучше делать после MCP skeleton, когда станет ясно, какие данные реально нужны.

## Minimal curl smoke tests

Эти команды нужны только для проверки API, не как основной интерфейс Alfy.

```bash
export TRACKER_API_BASE_URL="https://tracker.rocketup.tech/api"
export TRACKER_API_TOKEN="<jwt>"

curl -s \
  -H "Authorization: Bearer $TRACKER_API_TOKEN" \
  "$TRACKER_API_BASE_URL/goals"

curl -s \
  -H "Authorization: Bearer $TRACKER_API_TOKEN" \
  "$TRACKER_API_BASE_URL/tasks"

curl -s \
  -H "Authorization: Bearer $TRACKER_API_TOKEN" \
  "$TRACKER_API_BASE_URL/questions/habits?days=7"
```

## Recommended first milestone

Сделать не универсальный доступ ко всему приложению, а один сильный сценарий:

> Alfy вызывает `tracker_get_status_summary`, видит цели, задачи, привычки, просрочки и текущий фокус, после чего предлагает план на день/неделю и 1-3 корректировки.

Это даст пользу быстрее всего и не потребует рискованных write-действий на старте.
