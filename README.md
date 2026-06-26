# Alfy

**AI-секретарь и трекер целей, привычек и задач** — Telegram-бот, PWA-веб-приложение и MCP-сервер в одном монорепо. Alfy помогает ставить цели, разбивать их на ежедневные привычки, честно отвечать на вопросы о прогрессе и управлять всем этим хоть из Telegram, хоть из браузера, хоть прямо из Claude.

🌐 Прод: [tracker.rocketup.tech](https://tracker.rocketup.tech)

---

## Чем интересен проект

- **🤖 AI-native через MCP.** Отдельный [MCP-сервер](alfy-mcp/) даёт Claude Desktop / Claude Code полный набор инструментов для управления задачами, целями и привычками. Можно сказать ассистенту «создай цель на квартал и распиши привычки» — и он сделает это через типизированные tools, а не парсинг текста. Транспорты stdio и Streamable HTTP, авторизация по API-токенам из бота.
- **🎯 Цели → привычки → честный self-report.** Цель раскладывается на вопросы-привычки с расписанием (ежедневно / по дням недели / с интервалом). Семь типов вопросов: текст, оценка числом, оценка смайликами, да/нет, число, затраченное время, фото. Данные опроса — основа для аналитики и коучинга, а не «галочка выполнено».
- **📱 Три поверхности, один бэкенд.** Telegram-бот (telegraf), Telegram WebApp и обычный SPA — всё работает поверх одного REST API. Веб собран как PWA (offline, web-push, установка на домашний экран).
- **🧱 Чистая архитектура.** Бэкенд — Clean Architecture по модулям (порты в `domain/`, адаптеры в `infrastructure/`, оркестрация в сервисах). Фронтенд — Feature-Sliced Design. Границы слоёв реальны, а не декоративны.
- **🌍 Корректные таймзоны и локали.** Все операции с датами уважают IANA-таймзону пользователя; даты в БД хранятся в UTC и сдвигаются к wall-clock пользователя на границе домена. Календарь, локаль и первый день недели — из настроек пользователя.
- **🗓 Богатый UI задач.** Inbox, проекты со списками и board-колонками, повторяющиеся задачи, календарь с drag-create по сетке часов, Pomodoro-таймер, два независимых drag-and-drop-движка (кастомный на PointerEvents + vuedraggable).
- **🔔 Уведомления.** Web-push (VAPID) с подписками на устройство.
- **📦 Production-ready деплой.** Docker Compose + Caddy (авто-HTTPS), три независимо деплоящихся образа, единый reverse-proxy.

---

## Состав монорепо

| Приложение | Стек | Порт | Назначение |
|---|---|---|---|
| [`alfy-bot/`](alfy-bot/) | NestJS, TypeORM, SQLite, telegraf | 3002 | REST API (`/api`, Swagger на `/api/docs`), Telegram-бот, web-push, auth (JWT + API-токены) |
| [`alfy-bot-frontend/`](alfy-bot-frontend/) | Vue 3, Vite, TS, Tailwind v4, Pinia | 5173 | SPA / Telegram WebApp / PWA |
| [`alfy-mcp/`](alfy-mcp/) | Node 22+, `@modelcontextprotocol/sdk` | 3003 | MCP-сервер — тонкая обёртка над REST для Claude |

Плюс инфраструктура: [`docker-compose.yml`](docker-compose.yml), [`Caddyfile`](Caddyfile), [`scripts/tunnels.sh`](scripts/tunnels.sh).

Архитектурный гайд по всему репозиторию — в [CLAUDE.md](CLAUDE.md).

---

## Быстрый старт (dev)

Требования: Node 22+, npm. Каждое приложение запускается независимо.

```bash
# 1. Бэкенд (порт 3002)
cd alfy-bot
npm install
npm run start:dev          # nest start --watch

# 2. Фронтенд (порт 5173)
cd ../alfy-bot-frontend
npm install
npm run dev                # vite

# 3. MCP-сервер (опционально, порт 3003)
cd ../alfy-mcp
npm install
npm run dev:http           # Streamable HTTP, endpoint /mcp
```

Веб доступен на http://localhost:5173, API и Swagger — на http://localhost:3002/api/docs.

> Чтобы запустить бэкенд без Telegram-бота (только веб):
> `ENABLE_TELEGRAM=false npm run start:dev`

Подробные команды (тесты, lint, type-check) — в README каждого приложения и в [CLAUDE.md](CLAUDE.md).

---

## Деплой

```bash
docker compose up -d
```

Caddy слушает 80/443, отдаёт `tracker.rocketup.tech` и проксирует:
`/api/*` → backend (3002), `/mcp` + `/mcp/*` → alfy-mcp (3003), остальное → frontend (nginx). Образы тянутся из `${REGISTRY_URL}` (см. `.env`).

---

## Cloudflare-туннели (dev для Telegram WebApp)

Для тестирования Telegram WebApp нужны публичные URL фронта (5173) и бэкенда (3002). Используются Cloudflare Quick Tunnels.

```bash
./scripts/tunnels.sh
```

Скрипт:
1. Останавливает старые туннели на 5173 и 3002.
2. Запускает новые туннели.
3. Обновляет `alfy-bot/.env` (`WEBAPP_URL`) и `alfy-bot-frontend/.env` (`VITE_API_URL`).

Перед запуском должны быть подняты Vite (5173) и бэкенд (3002). После — перезапустить бота и фронт.

Остановка:

```bash
pkill cloudflared
# или точечно:
pkill -f "cloudflared tunnel --url http://localhost:5173"
pkill -f "cloudflared tunnel --url http://localhost:3002"
```

Требуется `cloudflared` в `PATH` ([установка](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation)).
