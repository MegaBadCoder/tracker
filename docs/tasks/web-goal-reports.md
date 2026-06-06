# Web Goal Reports

**Status:** design
**Branch:** main
**Worktree:** none
**Mode:** interactive

## Design

### Цель
Заполнять отчёты по целям из веба, а не только в Телеграме. Три части:
1. Переиспользуемый компонент `GoalReportForm` — заполнение отчёта по **одной** цели за заданную дату (по умолчанию сегодня; дата — проп). Вход: `goalId` + `date`; выход: событие `done`.
2. Кнопка «Сделать отчёт по цели» в `GoalView` → одиночный отчёт через тот же компонент.
3. Новая страница «Отчёт по всем целям за сегодня» — итеративно подставляет следующую цель с due+unanswered вопросами, пока не пройдут все цели дня. Использует тот же `GoalReportForm`.

### Текущее состояние (проверено в коде)
Веб-функционала заполнения отчётов **нет вообще** — это greenfield на фронте:
- Существуют только `views/GoalView.vue` (просмотр цели + редактирование вопросов) и `views/QuestionReportView.vue` (аналитика-графики). Ни формы заполнения, ни маршрута, ни API-клиента записи ответа нет. Список целей — `views/HomeView.vue` («Мои цели» + `GoalCard`, `fetchGoals('active')`). **`GoalsView.vue`/`GoalReportView.vue`/`GoalReportForm.vue` не существуют** (ранняя гипотеза о «сломанном каркасе» не подтвердилась).
- Маршруты целей (`router/index.ts`): `goals/new`, `goals/:id` (name `goal`), `questions/:id` (name `questionReport`). Маршрута отчёта нет.
- `api/reports.ts` содержит только `fetchQuestionAnalytics`.

Бэкенд уже умеет почти всё:
- `POST /questions/:id/answers { scheduled_date, answer: string }` → `ReportService.addAnswer` → `normalizeAnswer` → `answerRepo.save`. Это единственная запись ответа; реюзаем как есть.
- `normalizeAnswer` (report.service.ts:51): `number`/`rating` → `Number(...)` в `answer_number`; `yes_no` → `да|yes|true|1`→true, `нет|no|false|0`→false в `answer_bool`; `emoji_rating`/`time_spent`/`text` → только `answer_text` (число/булево остаются null). Во всех случаях `answer_text` хранит сырую строку.
- Due/answered логика готова: `ReportService.getUnansweredQuestions(goalId, date)`, `isDateFilled(goalId, date)`, `findLastUnfilledDate(goalId)`; `ScheduleService.isQuestionDueOnDateHistorical(q, date)`, `hasAnyQuestionDueToday(goal)`.
- Эндпоинтов уровня цели для веба (статус отчёта, очередь целей) нет — их добавляем.

### Формат ответа (ключевой факт — разобран по коду бота)
Бот формирует `callback_data` в `question-ui.util.ts:generateQuestionButtons`, а `@Action(/answer_(.+)/)` извлекает `answer = ctx.match[1]`. Это **точные** строки, которые уходят в `addAnswer`. Веб обязан слать **ровно их** (иначе расхождение с историей бота и с тем, что ждёт `normalizeAnswer`):
- `rating` → `"1".."5"` (`answer_${num}`) → парсится в `answer_number`
- `emoji_rating` → **`"1".."5"`** — это `answer_${index+1}` (1-based индекс), **НЕ сам эмодзи**. Хранится в `answer_text` (`answer_number` остаётся null). Эмодзи — только для отрисовки кнопки.
- `yes_no` → **`"yes"` / `"no"`** (`answer_yes`/`answer_no`), **НЕ `"Да"/"Нет"`**. `normalizeAnswer` мапит `yes`→true, `no`→false в `answer_bool`.
- `time_spent` → лейбл диапазона как есть (`answer_${option}` → `"<30 мин"`, `"30-60"`, `"1-2ч"`, `"2+ч"`). Хранится в `answer_text`.
- `number` → введённое число строкой → `answer_number`.
- `text` → свободный текст → `answer_text`.

Так веб-ответы неотличимы от ботовских и ложатся в существующие визуализации (`NumericVisual`/`EmojiRatingVisual`/`YesNoVisual`/`TextLogVisual`). **EmojiRatingVisual проверить в Plan** — какой формат он читает (индекс «1..5» vs эмодзи), чтобы веб и визуал сошлись.

### Выбранный подход (A)
**Backend** — два узких read-эндпоинта; запись реюзит существующий per-question POST.
- `GET /goals/:id/report-status?date=YYYY-MM-DD` → `{ goalId, date, lastUnfilledDate, questions: [{ questionId, question, type, can_skip, target_value, answered, answer_text, answer_number, answer_bool }], allDone }`. Due-на-дату через `isQuestionDueOnDateHistorical`, answered — через `answerRepo.findByQuestionsAndDate`. `date` по умолчанию = сегодня. `lastUnfilledDate` = `findLastUnfilledDate(goalId)` (для предложения дозаполнить прошлую дату).
- `GET /goals/report-queue?date=YYYY-MM-DD` → упорядоченный список целей с due+unanswered на дату: `[{ goalId, goalName, pendingCount }]`. Зеркалит фильтр бота (active goal; есть due-вопрос; не все обязательные заполнены). Для страницы «все цели за сегодня».
- Запись: существующий `POST /questions/:id/answers` — по вопросу, по мере ответа.

**Frontend**
- `features/goals/ui/GoalReportForm.vue` — props `{ goalId: number, date?: string }`, emit `done`. Грузит `report-status`, рендерит due-вопросы, на каждый — answer-input по типу, шлёт per-question POST, по «Готово»/последнему ответу → `done`. Про очередь не знает.
- `features/goals/ui/answer-inputs/` — компоненты по типам (`TextAnswerInput`, `NumberAnswerInput`, `RatingAnswerInput`, `EmojiRatingAnswerInput`, `YesNoAnswerInput`, `TimeSpentAnswerInput`) на примитивах shadcn-vue (`Button`, `Textarea`, `Input`). Опции/лейблы — из общего источника (см. инвариант), значение-строка = формат выше. Роутер-компонент `AnswerInput.vue` выбирает нужный по `type`.
- `views/GoalReportView.vue` (новый) + маршрут `goals/:id/report` (name `goalReport`) — обёртка одиночного отчёта: `<GoalReportForm :goalId :date>` , по `done` → назад к цели. Если `lastUnfilledDate` непуст — предлагает дозаполнить прошлую дату тем же компонентом.
- `views/GoalsReportFlowView.vue` (новый) + маршрут `goals/report-today` (name `goalsReportToday`) — последовательный проход по `report-queue`: `GoalReportForm` для текущей цели, по `done` → следующая; в конце — экран «Все отчёты на сегодня заполнены».
- `views/HomeView.vue` — кнопка «Заполнить отчёты за сегодня» (видна когда `report-queue` непустой) → `goalsReportToday`. В `GoalView.vue` — кнопка «Сделать отчёт по цели» → `goalReport`.
- `api/reports.ts` — `fetchGoalReportStatus(goalId, date?)`, `fetchGoalReportQueue(date?)`, `submitAnswer(questionId, scheduledDate, answer)` (или реюз из `goals.ts`).

Тред-офф: A добавляет 2 read-эндпоинта, но переиспользует существующую запись и due-логику; `report-status` обслуживает и одиночный вид, и деталь очереди; `report-queue` убирает N+1.

Отклонённые:
- **B** — без `report-queue`: фронт перебирает `/goals` и зовёт `report-status` на каждую (N+1; логика «pending» утекает на клиент).
- **C** — один комбинированный `GET /goals/report-today` со всеми целями и вложенными вопросами (меньше round-trip'ов, но тяжёлый ответ и сложнее точечный рефреш после сохранения одного вопроса).

### Охват дат
- Основной flow «все цели» — **только сегодня** (как «цели на сегодня» в формулировке задачи).
- Одиночный отчёт по цели — сегодня **+ предложение дозаполнить последнюю прошлую незаполненную дату** через `lastUnfilledDate` (зеркалит поведение бота `findLastUnfilledDate`). Сама форма параметризуется любой датой.

### Out of scope
- Тип вопроса `photo` — его нет во фронте этой ветки (отдельная фича в боте).
- Batch/атомарное сохранение всего отчёта одним запросом — пишем по-вопросно.
- Полный «реестр» всех прошлых пропусков (>1 даты подряд) в вебе — только последняя незаполненная, как у бота.
- Просмотр/редактирование уже сданных ответов — отдельная задача (форма показывает answered как заполненное, но не редактирует).

### Backwards-compat
Greenfield: новые read-эндпоинты, новый фронт-код, реюз существующего POST. Существующих потребителей `report-status`/`report-queue` нет. alfy-mcp не затрагивается. Риск регресса минимальный — добавление новых маршрутов/эндпоинтов/файлов.

### Unknowns (оставшиеся)
- Таймзона «сегодня»: бэк определяет сегодня по `User.timezone`, фронт — по локали браузера. Согласовать, кто формирует `date`. Предпочтительно: фронт шлёт явный `date` (локальный `YYYY-MM-DD`), `report-status`/`report-queue` доверяют ему; при отсутствии параметра бэк берёт today по `User.timezone`. Финализируется в Plan.
- Источник истины для опций answer-input на фронте: дублировать `QUESTION_TYPES` или вынести в общий конфиг. Во фронте уже есть `features/goals/ui/steps/question-types.ts` (метки для создания). Решается в Plan — вероятно расширить его `options`, чтобы не плодить второй список.

TDD: yes (backend `report-status`/`report-queue` сервис-логика и due-резолв — unit на сервисе; маппинг формата ответа по типам на фронте — unit; компонентные тесты `GoalReportForm`/flow — vitest где практично).

### Invariants
- Веб шлёт `answer`-строку, неотличимую от ботовской: `rating` → `"1".."5"`; `emoji_rating` → `"1".."5"` (1-based индекс, не эмодзи); `yes_no` → `"yes"`/`"no"`; `time_spent` → лейбл диапазона; `number` → число-строка; `text` → текст. Парсинг на бэке — существующий `normalizeAnswer`, без изменений.
- `report-status` и `report-queue` отдают только цели/вопросы текущего пользователя (owner-check, как в существующих контроллерах).
- «Due на дату» считается через `isQuestionDueOnDateHistorical` (исторический schedule), не latest.
- Запись ответа — только через `POST /questions/:id/answers`; никакого второго goal-level write-пути.
- Опции/лейблы типов вопросов берутся из единого конфига (`QUESTION_TYPES` на бэке / `question-types.ts` на фронте), не хардкодятся в инпутах.
- `answer` ≤ 200 символов (существующий `@MaxLength(200)` в `AnswerQuestionDto`) — инпуты не превышают.

### Principles
- `GoalReportForm` самодостаточен и переиспользуем: вход — `goalId` + `date`, выход — `done`; ничего не знает про «очередь» или конкретную страницу.
- Fail fast: ошибку сохранения ответа показываем, не глотаем; при неуспехе не переходим к следующему вопросу/цели.
- FSD: формы и answer-inputs — в `features/goals/ui`; примитивы — реюз shadcn-vue из `components/ui`, без новых зависимостей.
- Бэкенд-эндпоинты узкие, read-only, переиспользуют `ScheduleService`/`ReportService`, не дублируют due-логику.
- Никаких новых способов хранения ответа — единственный источник записи остаётся прежним.

## Plan
<empty — filled by up:uplan>

## Verify
<empty — filled by up:uverify>

## Conclusion
<empty — filled by up:ureview>

### Hands-off decisions
<empty — populated only when Mode is hands-off>

### Deferred (needs user input)
<empty — populated only when Mode is hands-off and a choice had no conservative default>
