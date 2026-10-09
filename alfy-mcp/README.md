# alfy-mcp

MCP-сервер для [Alfy](../README.md) — предоставляет инструменты для управления задачами, проектами, целями и привычками через Claude Desktop, Claude Code или любой MCP-клиент.

ESM-пакет, Node 22+. Тонкая обёртка над REST API [`alfy-bot`](../alfy-bot/): один HTTP-вызов на инструмент (кроме `get_progress` — 3 параллельных), в БД напрямую не ходит. SDK — [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol). Транспорты: stdio + Streamable HTTP (endpoint `/mcp`, порт 3003).

## Получить токен

Откройте «Настройки» → «MCP и агенты» в веб-приложении, задайте имя токена и нажмите «Создать токен». Скопируйте секрет сразу: после закрытия страницы он больше не показывается. Там же можно посмотреть список своих токенов и отозвать любой из них. Отзыв сразу прекращает доступ агента с этим токеном.

Также токен можно получить в Telegram-боте командой:

```
/mcp_token <название>
```

Название — произвольная метка токена (например `claude-desktop`). Токен даёт доступ к данным владельца, включая изменение задач.

## Подключить из Claude Desktop

Режим stdio (локальный процесс):

```json
{
  "mcpServers": {
    "alfy": {
      "command": "npx",
      "args": ["-y", "alfy-mcp", "--stdio"],
      "env": {
        "ALFY_API_TOKEN": "YOUR_ALFY_TOKEN",
        "ALFY_API_BASE": "https://tracker.rocketup.tech/api"
      }
    }
  }
}
```

## HTTP-режим (Streamable HTTP transport)

URL: `https://tracker.rocketup.tech/mcp`

Заголовок авторизации: `Authorization: Bearer YOUR_ALFY_TOKEN`. Для локального сервера адрес обычно `http://localhost:3003/mcp`.

В Codex добавьте в `~/.codex/config.toml`:

```toml
[mcp_servers.alfy]
url = "https://tracker.rocketup.tech/mcp"
bearer_token_env_var = "ALFY_MCP_TOKEN"
```

В Claude Code добавьте запись `alfy` в `mcpServers` файла `.mcp.json` в корне проекта, сохранив существующие серверы:

```json
{
  "mcpServers": {
    "alfy": {
      "type": "http",
      "url": "https://tracker.rocketup.tech/mcp",
      "headers": { "Authorization": "Bearer ${ALFY_MCP_TOKEN}" }
    }
  }
}
```

Перед запуском Codex или Claude Code выполните в Bash/Zsh команды ниже, затем вставьте токен и нажмите Enter. Ввод скрыт и не записывается в историю команд. Запустите агент из этого же терминала; в Claude Code проверьте подключение через `/mcp`.

```bash
export ALFY_MCP_TOKEN
read -rs ALFY_MCP_TOKEN
```

Ссылка на переменную в заголовке поддерживается [Claude Code](https://code.claude.com/docs/en/mcp#environment-variable-expansion-in-mcp-json).

Актуальные примеры с адресом текущего окружения доступны в настройках веб-приложения.

Протокол: [MCP Streamable HTTP](https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/transports/#streamable-http-transport)

## Инструменты

### Цели (Goals)

| Инструмент | Описание |
|---|---|
| `list_goals` | Список целей (опц. фильтр `status`: active/completed/archived) |
| `get_goal` | Получить цель по ID |
| `create_goal` | Создать цель (`goal_name`, `goal_start`, `goal_end`) |
| `add_questions_to_goal` | Добавить вопросы-привычки к цели |
| `update_goal` | Обновить название или статус цели |

### Задачи (Tasks)

| Инструмент | Описание |
|---|---|
| `list_tasks` | Список задач (фильтры: `project_id`, `status`, `due_from`, `due_to`) |
| `get_task` | Получить задачу по ID |
| `create_task` | Создать задачу |
| `update_task` | Обновить поля задачи |
| `complete_task` | Отметить задачу выполненной |
| `delete_task` | Удалить задачу |

Перенос задачи: `update_task` с `projectId` (UUID) или `null` (Inbox). Для задач Agile-проекта перенос во Входящие запрещён сервером. `create_task` и `update_task` принимают `groupId` и `sprintId`; `sprintId: null` оставляет задачу в бэклоге. При создании без `sprintId` задача наследует спринт истории. `list_tasks` принимает `sprint_id` (UUID либо `null` для бэклога) вместе с `project_id`.

### Проекты

| Инструмент | Описание |
|---|---|
| `list_projects` | Плоский список: `id, title, parentId, description, type, viewMode, icon, color, order` |
| `create_project` | Создать проект (`title`, опц. `type`: simple/agile, `parentId`, `description`, `viewMode`, `icon`, `color`) |
| `update_project` | Обновить поля; `null` снимает `parentId` / `description` / `icon` / `color` |
| `delete_project` | Удалить. Нужен `confirm: true`. 409, если есть дочерние проекты или задачи |
| `reorder_projects` | Порядок: полный массив `orderedIds` |

### Спринты и планирование историй

Все инструменты работают с правами владельца API-токена и требуют `projectId` (UUID). Тип проекта `agile` выбирается при создании и дальше не меняется.

- `list_sprints` — все спринты проекта, включая закрытые, с датами, целью и статусом.
- `create_sprint` — запланированный спринт; необязательные `name` и `goal`. Без имени сервер назначает «Спринт N».
- `update_sprint` — `id` и изменяемые `name`, `goal`, `startDate`, `endDate`; `null` очищает цель или дату. Закрытый спринт менять нельзя.
- `start_sprint` — `id`, обязательные даты `startDate` и `endDate` в формате `YYYY-MM-DD`, необязательная `goal`. В проекте допустим только один активный спринт.
- `complete_sprint` — `id` и обязательный `moveTo`: `backlog` либо UUID запланированного спринта. Незавершённые задачи и открытые истории переносятся; выполненные задачи остаются в закрытом спринте.
- `delete_sprint` — `id` и `confirm: true`. Задачи и истории сохраняются, назначение удалённого спринта очищается.
- `list_project_groups` — дерево эпиков и историй с UUID и назначениями спринтов/релизов.
- `move_story_to_sprint` — `storyId` и обязательный `sprintId`: UUID незакрытого спринта этого проекта либо `null` для бэклога. Перенос истории и её задач атомарен; задачи закрытых спринтов сохраняются. Ответ `{ updated: number }` содержит число перенесённых задач, включая скрытые выполненные. Пустую историю тоже можно перенести.

Например, после `list_project_groups` перенести выбранную историю и её задачи можно вызовом `move_story_to_sprint({ projectId, storyId, sprintId })`. Отдельную задачу переносят через `update_task({ id, sprintId })`.

### Привычки / Вопросы (Habits)

| Инструмент | Описание |
|---|---|
| `list_habits` | Список активных привычек с историей (опц. `days`: 7/14/30) |
| `get_question` | Получить вопрос по ID |
| `get_question_analytics` | История ответов на вопрос |
| `create_habit` | Создать привычку |
| `update_habit` | Обновить привычку |
| `update_habit_schedule` | Изменить расписание привычки |
| `delete_habit` | Деактивировать привычку |
| `answer_question` | Записать ответ на вопрос за дату |

### Прогресс

| Инструмент | Описание |
|---|---|
| `get_progress` | Агрегированный отчёт за `today` или `week` |

## Переменные окружения

| Переменная | По умолчанию | Описание |
|---|---|---|
| `ALFY_API_BASE` | `http://localhost:3002/api` | Базовый URL API |
| `ALFY_API_TOKEN` | — | API-токен (обязателен для stdio) |
| `MCP_HTTP_PORT` | `3003` | Порт HTTP-сервера |

## Разработка

```bash
npm install
npm run dev:stdio           # tsx src/cli.ts --stdio (для Claude Desktop/Code)
npm run dev:http            # tsx src/cli.ts --http (порт 3003, endpoint /mcp)
npm run build               # tsc → dist/
npm run start               # node dist/cli.js
npm run test                # vitest run
npm run lint                # eslint .
```
