# alfy-bot

Бэкенд [Alfy](../README.md) — NestJS-приложение (порт **3002**): REST API под `/api`, Telegram-бот, web-push и единая бизнес-логика для веба, бота и [MCP-сервера](../alfy-mcp/).

## Что внутри

- **REST API** под префиксом `/api`, Swagger UI — на `/api/docs` (Bearer auth).
- **Telegram-бот** на telegraf (`nestjs-telegraf`): создание целей, привычек и отчётов прямо в чате, выдача API-токенов для MCP.
- **Auth**: JWT + API-токены (`JwtOrApiTokenGuard`). Токены хранятся как bcrypt-хеш + 10-символьный prefix-index. Методы входа — Telegram и email/пароль (`nodemailer` для писем верификации/сброса).
- **Хранилище**: TypeORM + SQLite (`data/database.sqlite`, `synchronize: true`). S3-совместимое объектное хранилище (`@aws-sdk/client-s3`) для фото-ответов в отчётах.
- **Уведомления**: web-push (VAPID), подписки на устройство.
- **Планировщик** (`@nestjs/schedule`): повторяющиеся задачи, напоминания.

## Архитектура — Clean Architecture по модулям

Каждый бизнес-модуль в `src/modules/<name>/` следует трёхслойной структуре:

- `domain/` — порты (абстрактные классы как DI-токены `*Port`) и чистые утилиты без зависимостей от фреймворка.
- `infrastructure/` — реализации портов: TypeORM-репозитории, адаптеры внешних сервисов, schedulers.
- `*.service.ts` / `application/` — оркестрация, зависит только от портов.
- `dto/` — class-validator DTO. Корень модуля — `*.controller.ts`, `*.module.ts`, `*.service.ts`.

Биндинги портов — в `*.module.ts` через `{ provide: SomePort, useClass: SomeAdapter }`. Сервисы запрашивают `*Port`, а не конкретные классы.

Модули: `auth`, `bot`, `email`, `goal`, `notification`, `project`, `question`, `report`, `task`, `user`.

Сущности TypeORM собраны в `src/shared/entities/` (общий barrel) и регистрируются в `app.module.ts`. Кросс-модульный код — в `src/shared/` (`SharedModule`). Глобально включены `ValidationPipe({ whitelist: true, transform: true })`, префикс `/api`, CORS для localhost, Swagger Bearer auth.

> **Справочник типов вопросов** — единый источник истины в `src/shared/types/question-types.ts` (`QUESTION_TYPES`). Веб читает его через `GET /api/question-types`. Не дублировать на фронте.

## Таймзоны

Даты в БД хранятся в **UTC**. Доменные функции (`recurrence.utils.ts`) timezone-agnostic и работают через UTC-методы. На границе домена UTC сдвигается к wall-clock пользователя через `shiftToUserWallClock` / `shiftBackToUtc` (`src/modules/task/lib/timezone.ts`); таймзона — из `UserSettingsPort.getTimezone(userId)`.

## Команды

```bash
npm install
npm run start:dev           # nest start --watch (порт 3002)
npm run build               # nest build → dist/
npm run start:prod          # node dist/main
npm run lint                # eslint --fix
npm run test                # jest (*.spec.ts)
npm run test:watch
npm run test:cov
npm run test:e2e            # jest --config ./test/jest-e2e.json
npx jest path/to/file.spec.ts                 # один файл
npx jest -t "имя теста"                        # один тест по имени
```

Jest настроен в `package.json` (`rootDir: src`, `testRegex: .*\.spec\.ts$`, `ts-jest`).

> Запуск без Telegram-бота (только веб-API):
> `ENABLE_TELEGRAM=false npm run start:dev`

## Команды Telegram-бота

| Команда | Назначение |
|---|---|
| `/start`, `/menu` | Главное меню |
| `/help` | Справка |
| `/report` | Создать отчёт по цели |
| `/cancel` | Отменить текущий диалог |
| `/mcp_token <название>` | Выпустить API-токен для MCP-клиента |
| `/mcp_tokens` | Список выпущенных токенов |
| `/mcp_token_revoke` | Отозвать токен |

Остальной поток (создание целей, настройка вопросов-привычек, расписаний) — через inline-кнопки.
