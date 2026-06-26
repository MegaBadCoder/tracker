# alfy-bot-frontend

Веб-клиент [Alfy](../README.md) — Vue 3 + Vite + TypeScript + Tailwind v4 + Pinia (порт **5173**). Работает в трёх режимах: обычный SPA, Telegram WebApp и устанавливаемое PWA (offline + web-push).

## Возможности

- **Задачи**: Inbox, проекты со списками и board-колонками, повторяющиеся задачи, подзадачи.
- **Календарь**: недельная сетка с drag-create задач по часам, корректные локаль и первый день недели.
- **Цели и привычки**: создание цели, настройка вопросов-привычек, ежедневные отчёты, аналитика ответов и чарты (`chart.js` / `vue-chartjs`).
- **Pomodoro-таймер** с переносом незавершённых интервалов.
- **PWA**: кастомный service worker (workbox), web-push-подписки, установка на устройство.
- **i18n локали дат**: единый реактивный источник `composables/useLocale.ts` (язык, таймзона, первый день недели — из настроек пользователя).

## Стек и UI

- Vue 3 `<script setup>` + TS, Vite, Tailwind v4, Pinia, vue-router.
- UI-примитивы — **shadcn-vue** (`style: new-york`, `baseColor: neutral`, иконки lucide) поверх **reka-ui**. Источник истины — [shadcn-vue.com](https://www.shadcn-vue.com/), **не** React-доки. Перед новым компонентом проверь `src/components/ui/`.
- HTTP — axios (`src/api/client.ts`) с JWT-интерцептором и редиректом на `/login` по 401.

## Архитектура — Feature-Sliced Design

```
src/
  features/<name>/{api,lib,model,ui}/   # tasks, calendar, projects, task-timer, goals
  components/ui/                        # shadcn-vue примитивы
  components/                           # общие layout/виджеты (AppLayout, AppHeader, ...)
  views/                               # страницы из router/index.ts
  stores/                              # глобальные Pinia-сторы (user, question-types, navigation)
  api/                                 # общий HTTP-клиент, auth, tokenStorage
  composables/                         # useLocale, useCooldown, usePushSubscription, ...
  mocks/                               # MSW-моки для тестов
  sw.ts                                # кастомный service worker
```

### Drag-and-drop — два независимых стека (не смешивать)

- **Кастомный движок на PointerEvents** (`features/tasks/lib/dnd/`) — reorder задач в Inbox и list-проектах, drop на проекты/Inbox в сайдбаре, drag-create в календаре. Long-press 350ms на mobile, threshold 5px на desktop.
- **vuedraggable** — задачи внутри board-колонок, переупорядочивание колонок и проектов в сайдбаре.

> **Типы вопросов** грузятся с бэкенда (`GET /api/question-types` через `stores/question-types-store.ts`), не хардкодятся на фронте — иначе бот и веб рассинхронизируются.

## Команды

```bash
npm install
npm run dev                 # vite (порт 5173)
npm run build               # vue-tsc -b && vite build
npm run preview
npm run generate:pwa-icons
npm run lint                # eslint .
npm run test                # vitest (watch)
npm run test:run            # vitest run (CI)
npx vitest run path/to/file.spec.ts           # один файл
npx vue-tsc --noEmit -p tsconfig.app.json     # тип-чек без билда
```

Тесты — в `tests/` (зеркалят `src/`), env — `happy-dom`, сеть мокается через MSW.

## Конфиг

- `VITE_API_URL` — базовый URL бэкенда (`alfy-bot`, порт 3002). В dev обновляется `scripts/tunnels.sh` при работе через Cloudflare-туннели.
- `VITE_DEV_TELEGRAM_ID` — dev-флаг для авторизации без Telegram WebApp.

Авторизация: `main.ts` пробует `authorize()` при наличии `Telegram.WebApp.initData` или dev-флага. Router guard редиректит на `/login` любой не-public маршрут без токена (`meta: { public: true }` — исключения).
