# alfy-mcp

MCP-сервер для [Alfy](../README.md) — предоставляет инструменты для управления задачами, целями и привычками через Claude Desktop, Claude Code или любой MCP-клиент.

ESM-пакет, Node 22+. Тонкая обёртка над REST API [`alfy-bot`](../alfy-bot/): один HTTP-вызов на инструмент (кроме `get_progress` — 3 параллельных), в БД напрямую не ходит. SDK — [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol). Транспорты: stdio + Streamable HTTP (endpoint `/mcp`, порт 3003).

## Получить токен

В Telegram-боте выполни команду:

```
/mcp_token <название>
```

Название — произвольная метка токена (например `claude-desktop`).

## Подключить из Claude Desktop

Режим stdio (локальный процесс):

```json
{
  "mcpServers": {
    "alfy": {
      "command": "npx",
      "args": ["-y", "alfy-mcp", "--stdio"],
      "env": {
        "ALFY_API_TOKEN": "<токен из бота>",
        "ALFY_API_BASE": "https://tracker.rocketup.tech/api"
      }
    }
  }
}
```

## HTTP-режим (Streamable HTTP transport)

URL: `https://tracker.rocketup.tech/mcp`

Заголовок авторизации: `Authorization: Bearer <токен>`

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
