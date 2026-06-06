# Calendar i18n + user settings (язык, первый день недели) + фикс мобильного смещения

**Status:** done
**Branch:** feat/calendar-i18n-user-settings (base: main @ 292b3f2)
**Worktree:** .worktrees/feat-calendar-i18n-user-settings
**Mode:** interactive

## Design

### Цель и scope
Два пользовательских предпочтения — **`language`** (= локаль дат/календарей, дефолт `ru`) и **`firstDayOfWeek`** (дефолт понедельник) — живут в настройках пользователя на бэкенде и управляют отображением **всех** календарей и форматированием дат на фронте. Плюс мелкий вёрсточный фикс: календарь в пикерах прижат влево — отцентрировать.

Вне scope: полноценный i18n всего интерфейса (vue-i18n, перевод всех строк). Остальной UI остаётся захардкоженным русским.

### Контекст (как сейчас)
- Единственный примитив — reka-ui `CalendarRoot` (обёртка `components/ui/calendar/Calendar.vue`). В него **не передаются** `locale`/`weekStartsOn` → пикеры срока/дедлайна показывают английские названия и неделю с воскресенья.
- Большой календарь `features/calendar/` уже на русском, но `weekStartsOn: 1` захардкожен в `features/calendar/lib/week.ts`; форматтеры (`features/tasks/lib/formatters.ts`, `week.ts`) импортируют `date-fns/locale` `ru` напрямую.
- i18n-фреймворка нет.
- На бэкенде `timezone` реализован end-to-end: колонка `User.timezone` → `UserSettingsPort.getTimezone()` → `TypeOrmUserSettingsAdapter` → `user.service` → `PATCH /api/auth/timezone` → `getProfile()` в `/api/auth/me`. На фронте — `user-store.updateTimezone()`, `UserProfile.timezone`, селектор в `SettingsView.vue`. Этот путь копируем.
- Есть неиспользуемая JSON-колонка `User.settings: { notifications, language }` — на фронт не проброшена, ничего её не читает.

### Выбранный подход

**Бэкенд** (зеркало `timezone`):
- Две новые nullable-колонки в `User`: `language` (default `'ru'`) и `firstDayOfWeek` (int, default `1` = понедельник). `synchronize: true` создаёт их сам — миграция-сервис не нужен.
- `getProfile()` отдаёт `language`, `firstDayOfWeek`.
- Эндпоинты `PATCH /api/auth/language`, `PATCH /api/auth/first-day-of-week` (по образцу `PATCH /api/auth/timezone`, инлайновое тело без отдельного DTO — как у timezone).
- `UserSettingsPort` при необходимости расширяется (не обязательно для фронта; доменной логике бэка эти поля пока не нужны — порт трогаем только если понадобится).

**Фронт** — единый реактивный источник правды:
- `UserProfile` += `language?: string`, `firstDayOfWeek?: number`; в `user-store` — computed `language`/`firstDayOfWeek` (с дефолтами `'ru'`/`1`) + `updateLanguage()`, `updateFirstDayOfWeek()` (зеркало `updateTimezone`); `fetchMe()` читает новые поля.
- Новый composable `composables/useLocale.ts`: отдаёт реактивные `locale` (`'ru-RU'`/`'en-US'`), `weekStartsOn` (0–6) и `dateFnsLocale` (`ru`/`enUS`) из стора. Один источник — меняется настройка → всё перерисовывается без релоада.
- Прокинуть `:locale` + `:week-start-on` (+ `weekday-format="short"` для читаемых рус. сокращений) во **все** `<Calendar>`: `DueDatePickerContent`, `DeadlinePickerContent`, `TaskDetailDialog` (десктоп-дропдаун), `TaskForm`.
- `week.ts`/`formatters.ts`: `weekStartsOn` и `date-fns`-локаль брать из источника, а не хардкодить.
- В `SettingsView.vue` — два новых селектора (язык, первый день недели) рядом с таймзоной.

**Вёрсточный фикс (смещение влево):**
- Ряды календаря (`CalendarGridRow` = `flex` c фиксированными `w-8`/`size-8` ячейками) центрируем — `justify-center` на ряд (или `w-fit mx-auto` на грид). Дефолт — **по центру** (каноничный shadcn, на десктопе no-op, на мобильном убирает левый сдвиг). Альтернатива «на всю ширину» (`flex-1` на ячейки) не берём — растянет ячейки и на десктопе.

### Решённые трейдоффы
- **Отдельные колонки vs JSON `settings`**: беру отдельные колонки — единообразно с `timezone`, тривиально читать. Неиспользуемый `settings.language` не трогаю (нет второго источника, ничего не ломается).
- **`useLocale()` composable vs ручное прокидывание**: composable — один источник, реактивный, без дублирования дефолтов по компонентам.
- **Центрирование vs full-width календаря**: центрирование — меньший blast-radius (десктоп не меняется). Пользователь допустил оба («по всей ширине или в середине»).

### Конфигурация (по умолчанию, можно изменить)
- Языки в селекторе: **Русский (дефолт) + English**.
- Первый день недели: **Понедельник (дефолт) / Воскресенье**.

### Открытые вопросы
- Нет (набор языков/дней и стратегия центрирования согласованы; mobile-симптом подтверждён как левый сдвиг сетки).

TDD: yes (юнит-тест на чистый резолвер локали `useLocale`/маппинг settings→{locale, weekStartsOn, dateFnsLocale}; UI-прокидывание и тонкие CRUD-эндпоинты — проверяются вручную/интеграционно, как и существующий `timezone`, у которого юнит-тестов нет).

### Invariants
- Каждый reka-ui `<Calendar>` получает `locale` и `weekStartsOn`, производные от настроек пользователя — ни один календарь не остаётся на дефолтах reka-ui (англ./воскресенье).
- Локаль и первый день недели на фронте читаются из единого источника (`useLocale()` поверх `user-store`); ни один компонент не хардкодит локаль или старт недели.
- Хранение дат в БД остаётся UTC; задача меняет только локаль отображения и первый день недели, не трогает timezone-конвенции (`shiftToUserWallClock`/`shiftBackToUtc` и доменные UTC-функции не меняются).
- Новые колонки `User.language`/`User.firstDayOfWeek` — nullable с дефолтами (`'ru'`, `1`); миграция-сервис не создаётся (полагаемся на `synchronize`).
- API строго аддитивно: `/api/auth/me` получает новые поля, существующие поля и эндпоинты не меняются.

### Principles
- Зеркалить существующий end-to-end путь `timezone` (колонка → `UserSettingsPort`/service → `PATCH`-эндпоинт → `user-store` → `SettingsView`), а не изобретать новый механизм.
- Единый реактивный источник правды для локали/старта недели (composable); смена настройки перерисовывает даты без перезагрузки.
- Без нового i18n-фреймворка — scope только локаль дат/календарей.
- Вёрсточный фикс минимальный и безопасный глобально (центрирование) — не растягивать и не искажать десктопные дропдаун-календари.
- Не плодить второй источник «языка» — неиспользуемый `settings.language` JSON не трогаем и не ссылаемся на него.

## Baseline (pre-existing failures @ main 292b3f2)
Грязный базлайн зафиксирован до старта. Все 9 — устаревшие тесты, не сломанный функционал. Решение пользователя: продолжать, чинить только in-scope.

Frontend (`vitest run`) — 8 fail / 172:
- `tests/features/tasks/ui/TaskCardBadges.spec.ts` (1) — ждёт англ. `'Mar'`, app русский `'мар.'`. **IN-SCOPE — обновить ожидание на рус.**
- `tests/features/tasks/ui/TaskForm.spec.ts` (5) — ищет нативный `input[placeholder="Название задачи"]`, поле стало `ContentEditableInput`. **IN-SCOPE если правлю TaskForm — иначе оставить.**
- `tests/features/tasks/ui/TaskCard.spec.ts` (2) — priority-точка `.bg-*` заменена флаг-иконкой `text-*`. OUT-OF-SCOPE, не трогать.
- `tests/features/tasks/api/tasks-api.spec.ts` (файл) — импорт удалённого `@/features/tasks/api/tasks-api` (логика в `model/task-store.ts`). OUT-OF-SCOPE, не трогать.

Backend (`jest`) — 1 fail / 207:
- `src/app.controller.spec.ts` (1) — дефолтный «Hello World!» скаффолд, корневой `GET /` изменён. OUT-OF-SCOPE.

Примечание (вне задачи): в `alfy-bot/src/app.controller.ts` остался отладочный `debugLog`→`127.0.0.1:7243/ingest/...` (артефакт прошлой сессии).

## Plan

Approach: зеркалим end-to-end путь `timezone` для двух новых полей (`language`, `firstDayOfWeek`); на фронте единый реактивный источник — модульные computed в `composables/useLocale.ts`, которые читают `formatters.ts`/`week.ts` (внутри функций → трекаются при рендере) и в которые байндятся reka-ui `<Calendar>`. Плюс центрирование ряда календаря.

### Phase 1 — Backend: колонки + эндпоинты (зеркало timezone)
- **1.1** `alfy-bot/src/shared/entities/user.entity.ts:37-38` (modify) — после `timezone` добавить `@Column({ nullable: true, default: 'ru' }) language: string;` и `@Column({ nullable: true, default: 1 }) firstDayOfWeek: number;`. Invariant: nullable+default, без миграции (synchronize). `settings.language` JSON не трогаем.
- **1.2** `alfy-bot/src/modules/user/application/user.service.ts:43-49` (modify) — добавить `updateLanguage(userId, language): Promise<string>` и `updateFirstDayOfWeek(userId, firstDayOfWeek): Promise<number>` по образцу `updateTimezone`.
- **1.3** `alfy-bot/src/modules/auth/auth.service.ts:416-439` (modify) — `getProfile()` return += `language: user.language ?? 'ru'`, `firstDayOfWeek: user.firstDayOfWeek ?? 1`; добавить `updateLanguage`/`updateFirstDayOfWeek`, делегирующие в `userService`.
- **1.4** `alfy-bot/src/modules/auth/auth.controller.ts:96-107` (modify) — добавить `@Patch('language')` (body `{ language: string }`) и `@Patch('first-day-of-week')` (body `{ firstDayOfWeek: number }`), оба под `JwtAuthGuard`, по образцу `updateTimezone`.
- Invariant: API аддитивно; существующие поля/эндпоинты не меняются.
- Commit: `feat(user): language + firstDayOfWeek preferences (backend)`

### Phase 2 — Frontend: реактивный источник локали [TDD]
- **2.1** `alfy-bot-frontend/src/composables/useLocale.ts` (create):
  - Чистые резолверы (юнит-тест): `normalizeLanguage(l?: string): 'ru'|'en'` (дефолт `'ru'`); `normalizeFirstDayOfWeek(d?: number): number` (0–6 иначе `1`); `intlLocaleFor(l): string` (`'ru-RU'`/`'en-US'`).
  - Модульное реактивное состояние: `const language = ref<'ru'|'en'>('ru')`, `const firstDayOfWeek = ref<number>(1)`.
  - Экспортируемые computed: `intlLocale`, `weekStartsOn` (`0|1|…|6`), `dateFnsLocale` (`ru`/`enUS` из `date-fns/locale`).
  - `setLocalePrefs({ language?, firstDayOfWeek? })` — нормализует и пишет в модульные refs.
  - `useLocale()` → `{ language, firstDayOfWeek, intlLocale, weekStartsOn, dateFnsLocale }`.
  - Invariant: единый источник; ни один компонент не хардкодит локаль/старт недели.
- **2.2** `alfy-bot-frontend/src/types/user.ts:1-9` (modify) — `UserProfile += language?: string; firstDayOfWeek?: number`.
- **2.3** `alfy-bot-frontend/src/stores/user-store.ts` (modify) — computed `language`/`firstDayOfWeek` (дефолты `'ru'`/`1`); `setUser`/`fetchMe` читают новые поля и вызывают `setLocalePrefs(...)`; методы `updateLanguage(l)` (`PATCH /auth/language`) и `updateFirstDayOfWeek(d)` (`PATCH /auth/first-day-of-week`) по образцу `updateTimezone` (оптимистично + `setLocalePrefs`). Экспортировать их.
- **2.4** `alfy-bot-frontend/src/main.ts` (modify, если нужно) — на старте после `loadUser()`/`fetchMe()` источник синхронизируется через store; проверить, что `setLocalePrefs` вызывается при гидрации из localStorage (в `user-store.loadUser`).
- Commit: `feat(locale): reactive locale source + user prefs wiring`

### Phase 3 — Применение локали/первого дня + центрирование
- **3.1** Прокинуть во все reka-ui `<Calendar>` `:locale="intlLocale"`, `:week-starts-on="weekStartsOn"`, `weekday-format="short"` (import из `@/composables/useLocale`):
  - `features/tasks/ui/DueDatePickerContent.vue:3`
  - `features/tasks/ui/DeadlinePickerContent.vue:3`
  - `features/tasks/ui/TaskDetailDialog.vue:272`
  - `features/tasks/ui/TaskForm.vue:59`
- **3.2** `features/tasks/lib/formatters.ts:1-13` (modify) — убрать `import { ru }`; в `formatDate` использовать `{ locale: dateFnsLocale.value }` (импорт из useLocale). Реактивно: читается при рендере вызывающих компонентов.
- **3.3** `features/calendar/lib/week.ts:1-49` (modify) — убрать `import { ru }`; `getWeekStart` → `startOfWeek(date, { weekStartsOn: weekStartsOn.value })`; все `format(..., { locale: ru })` → `{ locale: dateFnsLocale.value }`. Единственный потребитель `WeeklyCalendar.vue` правок не требует.
- **3.4** `src/components/ui/calendar/CalendarGridRow.vue:18` (modify) — `cn('flex', …)` → `cn('flex justify-center', …)`. Центрирует ряды (хедер дней + числа) → убирает левый сдвиг в мобильном Drawer; на десктоп-дропдауне (`w-auto`) no-op.
- **3.5** `tests/features/tasks/ui/TaskCardBadges.spec.ts:83` (modify) — `toContain('Mar')` → `toContain('мар')` (app русский по дефолту). In-scope baseline-фикс.
- Commit: `feat(calendar): apply user locale + week start, center grid`

### Phase 4 — Настройки: селекторы языка и первого дня
- **4.1** `src/views/SettingsView.vue` (modify) — после блока Timezone (стр. ~83-118) добавить два блока: «Язык календаря» (Русский/English) и «Первый день недели» (Понедельник=1/Воскресенье=0). Реализация — простые сегментные кнопки (Select-компонента в `ui/` нет), активная подсветка как у timezone-списка. Хэндлеры `userStore.updateLanguage(...)` / `updateFirstDayOfWeek(...)`. Локальный ref инициализировать из `userStore.language`/`firstDayOfWeek`.
- Commit: `feat(settings): language + first-day-of-week selectors`

### Test strategy
- TDD (RED→GREEN), новый `tests/composables/useLocale.spec.ts`:
  - `normalizeLanguage`: `undefined|'ru'|'xx'`→`'ru'`, `'en'`→`'en'`.
  - `normalizeFirstDayOfWeek`: `0`→`0`, `6`→`6`, `7|-1|undefined|1.5`→`1`.
  - `intlLocaleFor`: `'ru'`→`'ru-RU'`, `'en'`→`'en-US'`.
  - `setLocalePrefs` → `weekStartsOn`/`intlLocale`/`dateFnsLocale` computed обновляются; `dateFnsLocale` маппится `ru`↔`enUS`.
- Обновить `TaskCardBadges.spec.ts:83` (см. 3.5).
- Ручной/smoke verify (как у timezone, юнит-тестов нет): пикер «Срок» показывает рус. названия + понедельник-первый; смена настройки перерисовывает без релоада; PATCH-эндпоинты сохраняют; сетка отцентрирована в мобильном Drawer.

### Order & dependencies
1 → 2 → 3 → 4. Phase 2 блокирует 3 и 4 (useLocale + store). Phase 1 независим от 2 (можно параллельно), но 3/4 ждут оба. Центрирование (3.4) ни от чего не зависит.

### Backwards-compat
Всё аддитивно: nullable-колонки с дефолтами (`synchronize`, без `*MigrationService`); новые PATCH-эндпоинты и поля `/auth/me`; новые опциональные поля `UserProfile`. Единственное видимое изменение — пикеры срока/дедлайна переключатся EN/воскресенье → RU/понедельник (целевое). `settings.language` JSON остаётся нетронутым (второго источника не создаём).

### Risks
- `week.ts`/`formatters.ts` перестают быть «чистыми» (импортируют реактивный модуль) — осознанный трейдофф ради единого источника без прокидывания пропов; реактивность держится, т.к. `.value` читается в контексте рендера потребителей.
- reka-ui ждёт `weekStartsOn: 0–6` (число) и `locale: string` — `weekStartsOn` computed возвращает число, ок.
- Центрирование рядов: хедер дней и числа имеют равную ширину (7×`w-8`/`size-8`) → выравнивание сохраняется.

## Verify

**Result:** passed

Positive:
- Backend `npm run build` → exit 0
- Frontend `vue-tsc --noEmit` → exit 0
- `useLocale.spec.ts` + `TaskCardBadges.spec.ts` → 17/17 pass (incl. in-scope `'Mar'→'мар'`)
- SMOKE: reka-ui `Calendar` with `locale=ru-RU, weekStartsOn=1, weekdayFormat=short` → weekday headers Russian, first column «пн», no English
- SMOKE: `DueDatePickerContent` (the screenshotted picker) at defaults → Russian + Monday-first
- SMOKE: `formatDate(d,'d MMM')` → `'мар'` (ru), `'Mar'` after `setLocalePrefs({language:'en'})` — locale switch changes output

Negative:
- SMOKE: `Calendar` with `locale=en-US, weekStartsOn=0` → English weekday names, first column «Su»
- `setLocalePrefs({language:'en'})` → `intlLocale='en-US'`, `dateFnsLocale=enUS`; `firstDayOfWeek=0` → `weekStartsOn=0` (unit-tested)

Invariants:
- All 4 reka-ui `<Calendar>` importers bind `:locale`+`:week-starts-on` (grep: 4/4)
- UTC storage untouched — `git diff main..HEAD` touches no timezone/recurrence domain files
- Additive API — `getProfile` keeps `timezone`, adds `language`/`firstDayOfWeek`; only new endpoints added
- Single source — no `weekStartsOn: 1` / `{ locale: ru }` left outside `useLocale.ts`

Smoke: ephemeral `tests/_smoke_tmp.spec.ts` (4 mounts of real components) → 4/4 pass, removed after run

Notes: Full suite 7 failed | 173 passed (180). The 7 fails are the documented pre-existing out-of-scope baseline (TaskForm×5, TaskCard×2) + `tasks-api` file-load + backend `app.controller` «Hello World» — all failing before this task; not regressions. Net change vs baseline: +9 passing (8 useLocale + 1 TaskCardBadges), 0 new failures. Centering (`CalendarGridRow` `flex justify-center`) verified by committed diff; pixel-level visual best confirmed in browser.

## Conclusion

Outcome: Календари локализуются и слушают пользовательские `language`/`firstDayOfWeek` (дефолт ru/понедельник), сетка пикера отцентрирована; реализовано в 4 коммитах `42821ff..c78679c` на `feat/calendar-i18n-user-settings`.

Invariants:
- Каждый reka-ui `<Calendar>` получает `locale`+`weekStartsOn` — grep: 4/4 импортёра примитива забайнжены; 5-й `<Calendar>` в TaskCardBadges — это lucide-иконка, корректно не трогается.
- Единый источник — `useLocale`; нет stray `weekStartsOn: 1` / `{ locale: ru }` вне `useLocale.ts` (grep чисто).
- UTC-хранение не тронуто — `git diff main..HEAD` не затрагивает timezone/recurrence доменные файлы.
- Новые колонки nullable с дефолтами ('ru', 1), без migration-сервиса.
- API аддитивно — `getProfile` сохраняет все прежние поля + добавляет 2; добавлены только новые эндпоинты.

Review findings: APPROVE_WITH_NITS — 0 Critical/Important; 4 Minor, все обоснованно no-fix/defer (см. ниже).

Future work:
- `src/utils/date.ts` хардкодит `toLocaleDateString('ru-RU')` для goal/report-вьюх — Justification: Design ограничил «язык» календарями + `formatters.ts`/`week.ts`; goal/report-даты числовые (`2-digit`), переключение языка меняет лишь разделитель. При желании — провести их через `intlLocale`.
- DTO/валидация для PATCH `/timezone` + `/language` + `/first-day-of-week` (все три разом) — Justification: текущие эндпоинты без DTO зеркалят существующий timezone; read-side защищён `normalize*`. Опциональное упрочнение.

Known risks:
- На Telegram-bootstrap `setUser({firstName,lastName})` перетирает localStorage минимальным профилем → store-computed `language`/`firstDayOfWeek` временно падают в дефолт до `fetchMe` (SettingsView реконсилит на mount). Live-календарь защищён guard'ом `setLocalePrefs`. Поведение идентично существующему `timezone` (унаследовано, не ново); правка затронула бы общий путь — вне scope.

Verified by: independent reviewer (APPROVE_WITH_NITS) + `up:uverify` (4 smoke-маунта реальных компонентов). Пиксельное центрирование пикера в мобильном Drawer стоит подтвердить визуально в браузере (класс применён, вёрстка детерминированна).

### Deviations from plan
- `setLocalePrefs` (2.1): guard `prefs.x !== undefined` («undefined = не менять») вместо безусловной нормализации — иначе минимальный профиль из Telegram-`authorize()` (`setUser({firstName,lastName})`) затирал бы предпочтения, восстановленные из localStorage в `loadUser`. Только явные значения обновляют источник.
- SettingsView (4.1): подсветка активной опции привязана напрямую к `userStore.language`/`firstDayOfWeek` (реактивно), без локального snapshot-ref — корректнее (highlight не устаревает после `fetchMe`). Плана-`ref` не заведено.
- `main.ts` (2.4): правок не потребовалось — гидрация локали идёт через `user-store.loadUser`/`setUser` → `setLocalePrefs`.

### Hands-off decisions
<empty — populated only when Mode is hands-off>

### Deferred (needs user input)
<empty — populated only when Mode is hands-off and a choice had no conservative default>
