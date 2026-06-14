# Backfill goal answers from frontend

**Status:** done
**Branch:** feat/backfill-goal-answers-frontend (base: main @ 1db81e3)
**Worktree:** .worktrees/feat-backfill-goal-answers-frontend
**Mode:** interactive

## Итерация (по запросу пользователя): календарь вместо списка

После первичной приёмки UX переделан со списка на **календарь** + отдельная кнопка **«Заполнить за сегодня»** (commit `ba9fce4`).

- Backend: `GET /questions/:id/unfilled-dates` → **`/fill-status`**; метод `getUnfilledDates` → `getFillStatus`, возвращает `{ date, filled }[]` по всем due-дням диапазона (кап 90 убран — календарь маркирует и заполненные дни). DTO `FillStatusEntryDto`.
- Frontend: `QuestionBackfillList.vue` → **`QuestionBackfillCalendar.vue`** на reka-ui (`CalendarRoot` + ui-обёртки + сырой `CalendarCellTrigger as="button"`). Маркировка: заполнено (✓ + заливка), незаполнено due (обводка, кликабельно), не-due/будущее (приглушено через `isDateUnavailable` + `maxValue=today`). Клик по дню → `AnswerInput` под календарём; кнопка «Заполнить за сегодня» (disabled-состояния: «уже заполнено» / «не запланировано»). Запись по-прежнему через `submitAnswer`/`submitPhotoAnswer`.
- Тесты: backend `getFillStatus` (статус/расписание/диапазон/owner/empty), frontend `QuestionBackfillCalendar.spec.ts` (кнопка сегодня, клик дня, submit→дата→filled, ошибка). Инварианты прежние.

---

## Design

### Цель
На странице вопроса цели (`questions/:id`, `QuestionReportView.vue`) дать заполнять ответы **по одному вопросу за прошлые/сегодняшний дни**: показать незаполненные due-даты и дать ввести ответ за каждую. «Заполнить новый день» = сегодня (если due и ещё не заполнено) — это просто верхняя строка списка. Дедупликация: уже отвеченные дни (через бота, ежедневный веб-отчёт или эту же форму) не предлагаются повторно.

Сейчас `QuestionReportView` показывает только график (`QuestionVisual`) + редактор расписания + тумблер «Привычка». UI заполнения **нет вообще** — это дыра.

### Ключевой факт: единый источник истины
Бот, ежедневный веб-отчёт (`GoalReportForm`) и эта новая форма пишут в **одну** таблицу `report_answers` (по `question_id` + `scheduled_date`). Значит «вопрос заполнен» ≡ наличие строки в `report_answers`. Дедупликация выходит автоматически — не нужен отдельный флаг/состояние. Записанный ответ за день перестаёт быть «незаполненным» сразу во всех трёх местах.

### Что переиспользуем (уже готово)
- `AnswerInput.vue` (`features/goals/ui/answer-inputs/`) — виджет ввода по `type`, эмитит `submit(answer)` / `submitPhoto(file)`. Принимает только `type` → работает с любым вопросом. Строки-ответы уже бот-совместимы (см. `answer-format.ts`).
- `submitAnswer(questionId, date, answer)` и `submitPhotoAnswer(questionId, date, file)` (`api/reports.ts`) — единственные write-пути; реюз как есть.
- Бэкенд-итерация по due-датам с флагом filled — уже есть в `ReportService.getQuestionAnalytics` (от `goal_start` до `min(goal_end, today)`, `isQuestionDueOnDateHistorical` / `getScheduleForDate`). Новый метод повторит ту же итерацию, но вернёт только незаполненные даты.

### Выбранный подход
**Frontend (основное):** новый самодостаточный компонент `features/goals/ui/QuestionBackfillList.vue`.
- Пропсы: `questionId: number`, `type: QuestionType`.
- При монтировании грузит список незаполненных due-дат (новый эндпоинт, см. ниже).
- Рендерит секцию «Незаполненные дни (N)» — строки, новые сверху (включая «Сегодня», «Вчера», иначе форматированная дата через `formatters` + `useLocale`).
- Тап по строке → inline раскрывает `AnswerInput :type` в строке. `submit`/`submitPhoto` → `submitAnswer`/`submitPhotoAnswer` с датой этой строки.
- Успех → строка исчезает (optimistic) + эмит `filled` родителю (для рефреша графика/галереи). Ошибка → строка остаётся, ошибка у строки (fail-fast).
- Пустой список → ненавязчивое «Все дни заполнены ✓» (или скрыть секцию).
- Подключается в `QuestionReportView.vue` под графиком; по `@filled` страница перезапрашивает analytics (не-photo) / gallery (photo), чтобы новый ответ появился на графике.

**Backend (тонкий, type-agnostic):** новый `GET /questions/:questionId/unfilled-dates`.
- В `ReportController` (`@Controller('questions')`, рядом с `analytics`). Owner-check как в analytics (вопрос → цель → `user_id`).
- `ReportService.getUnfilledDates(questionId, userId): Promise<{ date: string }[]>` — та же итерация по диапазону [`goal_start`, `min(goal_end, today)`] + `isQuestionDueOnDateHistorical`, но возвращает только даты **без** строки в `report_answers`. Работает одинаково для всех типов, включая `photo` (фото-ответ = строка → считается заполненным). Порядок — новые сверху. Кап: последние `MAX_BACKFILL_DAYS = 90` незаполненных дат (защита от гигантского списка на долгой цели); если упёрлись в кап — фронт показывает «показаны последние N».
- Цель без диапазона дат (global) → пустой список (НЕ 400, в отличие от analytics — страница просто ничего не предлагает).

### Почему отдельный эндпоинт, а не реюз analytics на фронте
Analytics для не-photo уже отдаёт `filled`, но: (1) на фронте для photo analytics не вызывается (там gallery, которая даёт только заполненные — множество «due-но-пусто» из неё не получить); (2) analytics — charting-DTO с плейсхолдерами (`NOT_FILLED_TEXT`, `answer_number:0`), завязывать на него бэкфилл = хрупкая связь с логикой графиков. Отдельный intention-revealing эндпоинт даёт один путь для всех типов и развязывает бэкфилл с чартингом. Цена — ~30 строк, переиспользующих ту же итерацию.

### Backwards-compat
Аддитивно. Новый GET-эндпоинт, новый компонент, новая секция на странице. Схема БД не меняется. `submitAnswer`/`submitPhotoAnswer` реюзятся как есть. Существующие потребители (бот, ежедневный отчёт, графики) не затрагиваются. Ломающих изменений нет.

### Out of scope
- Заполнение будущих дат (бессмысленно — нет ответов наперёд).
- Произвольный выбор дат вне расписания (только due-даты по историческому расписанию).
- Изменение ежедневного отчёта/бота — они уже пишут в ту же таблицу, дедуп работает сам.
- Multi-photo на дату (как и раньше — 1 фото/дата, перезагрузка перезаписывает).

TDD: yes

### Invariants
- Запись ответов — только через существующие `submitAnswer` / `submitPhotoAnswer` (POST `/questions/:id/answers` и `/answers/photo`). Новых write-эндпоинтов не вводим.
- «Заполнено/нет» определяется ИСКЛЮЧИТЕЛЬНО наличием строки в `report_answers` (`question_id`+`scheduled_date`) — общий источник с ботом и ежедневным отчётом. Не вводить отдельный флаг/состояние заполнения.
- Виджет ввода — переиспользуемый `AnswerInput` (по `type`); не дублировать инпуты по типам.
- Список незаполненных — только due-даты по историческому расписанию (`isQuestionDueOnDateHistorical`) в диапазоне [`goal_start`, `min(goal_end, today)`]. Будущее не предлагается.
- Строки-ответы остаются бот-совместимыми (гарантируется answer-inputs / `answer-format.ts`) — веб и бот пишут идентичные строки.
- Новый эндпоинт делает owner-check (вопрос → цель → `user_id`), как `analytics`; чужой вопрос → 403/404.

### Principles
- Реюз поверх дублирования: `AnswerInput`, `submitAnswer`/`submitPhotoAnswer`, паттерн analytics-эндпоинта.
- Единый источник истины для статуса заполнения — `report_answers`; никакого параллельного состояния.
- Fail fast: ошибку submit показываем у строки, строку не убираем, список не трогаем.
- Type-uniform: один путь для всех типов вопросов, включая `photo`; без branchy-логики на фронте.
- FSD: компонент в `features/goals/ui`, подключение в `views/`; примитивы shadcn-vue, без новых зависимостей.

## Plan

Approach: тонкий type-agnostic бэкенд-метод `getUnfilledDates` (копия итерации `getQuestionAnalytics`, но отдаёт только незаполненные due-даты) + новый фронт-компонент `QuestionBackfillList` с inline-вводом через переиспользуемые `AnswerInput` и `submitAnswer`/`submitPhotoAnswer`. Запись и дедуп — на существующей таблице `report_answers`, ничего не дублируем.

### Phase 1 — Backend: unfilled-dates endpoint

- **1.1** `alfy-bot/src/modules/report/application/report.service.ts:395` (modify, рядом с `getQuestionAnalytics`)
  - Добавить `MAX_BACKFILL_DAYS = 90` (модульная константа возле `NOT_FILLED_TEXT:16`).
  - `getUnfilledDates(questionId: number, dbUserId: number): Promise<string[]>` — owner-check как в analytics (вопрос→цель→`user_id`; нет вопроса/цели → NotFound, чужая → Forbidden). Цель **без** `goal_start`/`goal_end` → вернуть `[]` (НЕ BadRequest — отличие от analytics). Та же итерация по [`goal_start`, `min(goal_end, today)`] с `getScheduleForDate` + `isScheduleDueOnDate`; собрать `toLocalISO(cursor)` для due-дат **без** ответа в `answerByDate` (реюз `findByQuestionAndDateRange`). Вернуть новые-сверху (`.reverse()`), срезать первые `MAX_BACKFILL_DAYS`.
  - Invariant: «заполнено» = наличие строки в `report_answers`; список — только due-даты по историческому расписанию; owner-check.
- **1.2** `alfy-bot/src/modules/report/report.controller.ts:35` (modify, рядом с `getQuestionAnalytics`)
  - `@Get(':questionId/unfilled-dates')` → `getUnfilledDates(@Request() req, @Param('questionId', ParseIntPipe) id): Promise<string[]>` → `reportService.getUnfilledDates(id, req.user.sub)`. `@ApiOkResponse({ type: [String] })`, owner/404/403 swagger-ответы как у analytics.
  - Invariant: новый эндпоинт только READ; write остаётся через существующий `POST /answers`.
- Commit: `feat(report): GET /questions/:id/unfilled-dates for backfill`

### Phase 2 — Frontend: backfill list on question page

- **2.1** `alfy-bot-frontend/src/api/reports.ts:71` (modify, рядом с `submitAnswer`)
  - `fetchUnfilledDates(questionId: number): Promise<string[]>` → `GET /questions/${questionId}/unfilled-dates`.
- **2.2** `alfy-bot-frontend/src/features/goals/ui/QuestionBackfillList.vue` (create)
  - Props `{ questionId: number, type: QuestionType }`; emit `(e:'filled')`.
  - State: `dates = ref<string[]>([])`, `loading`, `error`, `expanded = ref<string|null>`, `submitting`.
  - `onMounted` → `fetchUnfilledDates`. Заголовок «Незаполненные дни (N)»; пусто → ненавязчивое «Все дни заполнены ✓».
  - Строка (новые сверху): `dayLabel(date)` (локальный pure-helper: `isToday`→«Сегодня», `isYesterday`→«Вчера», иначе `formatDate(date, DATE_FULL)` из `features/tasks/lib/formatters`, локаль через `useLocale`). Тап → `expanded = date` раскрывает `<AnswerInput :type :key="date" @submit @submit-photo>` inline.
  - `onAnswer(a)` → `submitAnswer(questionId, expanded, a)`; `onPhoto(f)` → `submitPhotoAnswer(questionId, expanded, f)`. Успех → удалить дату из `dates`, `expanded=null`, `emit('filled')`. Ошибка → строку оставить, показать ошибку у строки (fail-fast). `submitting` блокирует ввод.
  - Если `dates.length === MAX (90)` — мелкая подпись «показаны последние 90».
  - Invariants: реюз `AnswerInput`/`submitAnswer`/`submitPhotoAnswer`; не дублировать инпуты; fail-fast.
- **2.3** `alfy-bot-frontend/src/views/QuestionReportView.vue:75-90, 133-145` (modify)
  - Вынести загрузку визуалов (`fetchQuestionAnalytics`/`fetchPhotoGallery`) из `onMounted` в `loadVisuals()`; `onMounted` зовёт её.
  - В шаблон под блоком `QuestionVisual` (после строки ~144) вставить `<QuestionBackfillList :question-id="question.id" :type="question.type" @filled="loadVisuals" />`.
- Commit: `feat(goals): backfill unfilled answers from question page`

### Test strategy (TDD: yes)

- **Backend** `report.service.spec.ts` (new `describe('getUnfilledDates')`, зеркалит существующие моки): возвращает только due-даты без ответа (исключает заполненные = дедуп); новые-сверху; не включает не-due даты по расписанию; цель без дат → `[]`; чужой вопрос → Forbidden / нет вопроса → NotFound; уважает кап 90.
- **Frontend** `tests/features/goals/QuestionBackfillList.spec.ts` (паттерн `GoalReportForm.spec.ts`, `vi.mock('@/api/reports')`): рендерит N незаполненных дней; тап раскрывает `AnswerInput`; submit зовёт `submitAnswer` с верными `(questionId, date, answer)` и убирает строку + эмитит `filled`; ошибка submit — строка остаётся; пустой список → «Все дни заполнены».

### Order & dependencies

Phase 1 → Phase 2 (фронт-API дергает новый эндпоинт). Внутри Phase 1: 1.1 → 1.2.

### Backwards-compat

Greenfield-аддитивно: новый READ-эндпоинт, новый компонент, новая секция. Схема БД, существующие эндпоинты, бот, ежедневный отчёт и графики не затрагиваются — проверять нечего.

## Verify

**Result:** passed

Positive:
- `getUnfilledDates` возвращает только due-даты без ответа (дедуп), новые сверху, кап 90 — backend report-тесты (75 passed)
- `QuestionBackfillList`: рендер N дней, раскрытие `AnswerInput`, submit зовёт `submitAnswer(questionId, date, answer)` → строка удаляется + emit `filled` — frontend goals-тесты (92 passed)
- Обе сборки: `nest build` OK, `vite build` OK; `vue-tsc --noEmit` чисто

Negative:
- чужой/несуществующий вопрос → Forbidden/NotFound; submit error оставляет строку (fail-fast) — покрыто тестами

Invariants:
- компонент пишет только через `submitAnswer`/`submitPhotoAnswer`, читает `fetchUnfilledDates`, реюзит `AnswerInput` — нет прямых write-вызовов api (grep)
- цель без диапазона дат → `[]` (не 400); статус заполнения — только из `report_answers`

Notes: живой браузерный/curl smoke не выполнен — backend требует `.env` (отсутствует в worktree) для полного boot; пользователь запустит приложение вручную на финише (явный запрос). Маршрут скомпилирован и под тем же `JwtOrApiTokenGuard`, что соседний `analytics` на том же контроллере.

## Conclusion

Outcome: бэкфилл ответов на вопрос цели с фронта (страница `questions/:id`) — READ-эндпоинт `unfilled-dates` + компонент `QuestionBackfillList`, дедуп через общую `report_answers`. Коммиты `25f9ccf`, `d1242fd`, `dc219f6`.

Invariants:
- Запись только через `submitAnswer`/`submitPhotoAnswer`; новый эндпоинт READ-only — grep компонента: нет прямых write-вызовов api.
- Статус заполнения — исключительно `report_answers` (та же таблица, что бот/ежедневный отчёт); параллельного состояния нет.
- Реюз `AnswerInput` по `type`; инпуты не дублированы.
- Список — только due-даты по расписанию (`getScheduleForDate`+`isScheduleDueOnDate`) в [`goal_start`, `min(goal_end, today)`]; будущее не предлагается.
- Бот-совместимый формат строк сохранён (через answer-inputs/answer-format).
- Owner-check на эндпоинте (вопрос→цель→user_id); чужой → Forbidden/NotFound — покрыто тестами.

Review findings:
- Critical: новые backend-тесты `getUnfilledDates` хардкодили `2026-06-14` как «сегодня» без мока `Date` (проходили лишь в этот календарный день) — исправлено `jest.useFakeTimers()`/`setSystemTime` (`dc219f6`); доказано сдвигом фейк-даты (date-тесты падают на 2026-08-20, зелёные на 2026-06-14).

Verified by: живой браузерный/curl smoke не запускался (backend требует `.env`, отсутствует в worktree) — пользователь проверит вручную при запуске приложения на финише.

### Hands-off decisions
<empty — populated only when Mode is hands-off>

### Deferred (needs user input)
<empty — populated only when Mode is hands-off and a choice had no conservative default>
