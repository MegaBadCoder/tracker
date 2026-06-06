# Web Goal Reports

**Status:** done
**Branch:** feat/web-goal-reports (base: chore/deploy-smtp-s3-env-secrets @ 6060bff; merged photo feature origin/feat/goal-report-photo-questions @ 329670b)
**Worktree:** .worktrees/feat-web-goal-reports
**Mode:** interactive

## Design

### Цель
Заполнять отчёты по целям из веба, а не только в Телеграме. Три части:
1. Переиспользуемый компонент `GoalReportForm` — заполнение отчёта по **одной** цели за заданную дату (по умолчанию сегодня; дата — проп). Вход: `goalId` + `date`; выход: событие `done`.
2. Кнопка «Сделать отчёт по цели» в `GoalView` → одиночный отчёт через тот же компонент.
3. Новая страница «Отчёт по всем целям за сегодня» — итеративно подставляет следующую цель с due+unanswered вопросами, пока не пройдут все цели дня. Использует тот же `GoalReportForm`.

**Фото-ответы включены в scope** (расширение по запросу пользователя): веб-форма умеет и текст/число/рейтинг/etc, **и загрузку фото** для вопросов `type === 'photo'`. Фото-фича уже вмёржена в ветку (`329670b`); бэкенд для веба готов — есть `POST /questions/:id/answers/photo` (multipart) и `GET /questions/:id/photo-gallery`.

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
- `photo` → **не строка**: отдельный путь `POST /questions/:id/answers/photo` (multipart, поле `photo` + `scheduled_date`). Бэкенд `addPhotoAnswer` грузит в S3, пишет строку `report_answers` с `photo_key` и `answer_text=''`. Из-за наличия строки фото-вопрос автоматически считается answered в `report-status`/`report-queue` (та же `findByQuestionsAndDate`).

Так текстовые веб-ответы неотличимы от ботовских и ложатся в существующие визуализации (`NumericVisual`/`EmojiRatingVisual`/`YesNoVisual`/`TextLogVisual`). **EmojiRatingVisual проверить в Plan** — какой формат он читает (индекс «1..5» vs эмодзи), чтобы веб и визуал сошлись.

### Выбранный подход (A)
**Backend** — два узких read-эндпоинта; запись реюзит существующий per-question POST.
- `GET /goals/:id/report-status?date=YYYY-MM-DD` → `{ goalId, date, lastUnfilledDate, questions: [{ questionId, question, type, can_skip, target_value, answered, answer_text, answer_number, answer_bool }], allDone }`. Due-на-дату через `isQuestionDueOnDateHistorical`, answered — через `answerRepo.findByQuestionsAndDate`. `date` по умолчанию = сегодня. `lastUnfilledDate` = `findLastUnfilledDate(goalId)` (для предложения дозаполнить прошлую дату).
- `GET /goals/report-queue?date=YYYY-MM-DD` → упорядоченный список целей с due+unanswered на дату: `[{ goalId, goalName, pendingCount }]`. Зеркалит фильтр бота (active goal; есть due-вопрос; не все обязательные заполнены). Для страницы «все цели за сегодня».
- Запись: существующий `POST /questions/:id/answers` — по вопросу, по мере ответа.

**Frontend**
- `features/goals/ui/GoalReportForm.vue` — props `{ goalId: number, date?: string }`, emit `done`. Грузит `report-status`, рендерит due-вопросы, на каждый — answer-input по типу, шлёт per-question POST (текст) либо multipart POST (фото), по «Готово»/последнему ответу → `done`. Про очередь не знает.
- `features/goals/ui/answer-inputs/` — компоненты по типам (`TextAnswerInput`, `NumberAnswerInput`, `RatingAnswerInput`, `EmojiRatingAnswerInput`, `YesNoAnswerInput`, `TimeSpentAnswerInput`, `PhotoAnswerInput`) на примитивах shadcn-vue (`Button`, `Textarea`, `Input`). Текстовые — `emit('submit', string)`; фото — `emit('submitPhoto', File)`. Опции/лейблы — из общего источника (см. инвариант). Роутер-компонент `AnswerInput.vue` выбирает нужный по `type` и пробрасывает оба события. `PhotoAnswerInput`: `<input type="file" accept="image/*" capture>` + превью выбранного файла + кнопка «Загрузить»; на mobile `capture` даёт прямой доступ к камере.
- `views/GoalReportView.vue` (новый) + маршрут `goals/:id/report` (name `goalReport`) — обёртка одиночного отчёта: `<GoalReportForm :goalId :date>` , по `done` → назад к цели. Если `lastUnfilledDate` непуст — предлагает дозаполнить прошлую дату тем же компонентом.
- `views/GoalsReportFlowView.vue` (новый) + маршрут `goals/report-today` (name `goalsReportToday`) — последовательный проход по `report-queue`: `GoalReportForm` для текущей цели, по `done` → следующая; в конце — экран «Все отчёты на сегодня заполнены».
- `views/HomeView.vue` — кнопка «Заполнить отчёты за сегодня» (видна когда `report-queue` непустой) → `goalsReportToday`. В `GoalView.vue` — кнопка «Сделать отчёт по цели» → `goalReport`.
- `api/reports.ts` — `fetchGoalReportStatus(goalId, date?)`, `fetchGoalReportQueue(date?)`, `submitAnswer(questionId, scheduledDate, answer)`, `submitPhotoAnswer(questionId, scheduledDate, file: File)` (multipart через `FormData`).

Тред-офф: A добавляет 2 read-эндпоинта, но переиспользует существующую запись и due-логику; `report-status` обслуживает и одиночный вид, и деталь очереди; `report-queue` убирает N+1.

Отклонённые:
- **B** — без `report-queue`: фронт перебирает `/goals` и зовёт `report-status` на каждую (N+1; логика «pending» утекает на клиент).
- **C** — один комбинированный `GET /goals/report-today` со всеми целями и вложенными вопросами (меньше round-trip'ов, но тяжёлый ответ и сложнее точечный рефреш после сохранения одного вопроса).

### Охват дат
- Основной flow «все цели» — **только сегодня** (как «цели на сегодня» в формулировке задачи).
- Одиночный отчёт по цели — сегодня **+ предложение дозаполнить последнюю прошлую незаполненную дату** через `lastUnfilledDate` (зеркалит поведение бота `findLastUnfilledDate`). Сама форма параметризуется любой датой.

### Out of scope
- Batch/атомарное сохранение всего отчёта одним запросом — пишем по-вопросно.
- Полный «реестр» всех прошлых пропусков (>1 даты подряд) в вебе — только последняя незаполненная, как у бота.
- Просмотр/редактирование уже сданных ответов — отдельная задача (форма показывает answered как заполненное, не редактирует). Для photo «answered» = фото уже загружено; повторная загрузка (перезапись) — вне scope этой формы, хотя бэкенд её поддерживает.
- Галерея фото в форме отчёта — её место на странице вопроса (`QuestionReportView` уже показывает `PhotoGalleryVisual`). Форма отчёта только загружает фото на дату.

### Backwards-compat
Greenfield: новые read-эндпоинты, новый фронт-код, реюз существующих write-эндпоинтов (текстовый `POST :id/answers` и фото `POST :id/answers/photo`). Существующих потребителей `report-status`/`report-queue` нет. alfy-mcp не затрагивается. Фото-фича (`329670b`) вмёржена в ветку — её бэкенд/тесты не трогаем, только дописываем фронтовый клиент загрузки. Риск регресса минимальный — добавление новых маршрутов/файлов.

### Unknowns (оставшиеся)
- Таймзона «сегодня»: бэк определяет сегодня по `User.timezone`, фронт — по локали браузера. Согласовать, кто формирует `date`. Предпочтительно: фронт шлёт явный `date` (локальный `YYYY-MM-DD`), `report-status`/`report-queue` доверяют ему; при отсутствии параметра бэк берёт today по `User.timezone`. Финализируется в Plan.
- Источник истины для опций answer-input на фронте: дублировать `QUESTION_TYPES` или вынести в общий конфиг. Во фронте уже есть `features/goals/ui/steps/question-types.ts` (метки для создания). Решается в Plan — вероятно расширить его `options`, чтобы не плодить второй список.

TDD: yes (backend `report-status`/`report-queue` сервис-логика и due-резолв — unit на сервисе; маппинг формата ответа по типам на фронте — unit; компонентные тесты `GoalReportForm`/flow — vitest где практично).

### Invariants
- Веб шлёт `answer`-строку, неотличимую от ботовской: `rating` → `"1".."5"`; `emoji_rating` → `"1".."5"` (1-based индекс, не эмодзи); `yes_no` → `"yes"`/`"no"`; `time_spent` → лейбл диапазона; `number` → число-строка; `text` → текст. Парсинг на бэке — существующий `normalizeAnswer`, без изменений.
- `report-status` и `report-queue` отдают только цели/вопросы текущего пользователя (owner-check, как в существующих контроллерах).
- «Due на дату» считается через `isQuestionDueOnDateHistorical` (исторический schedule), не latest.
- Запись ответа идёт только через существующие per-question эндпоинты: текстовый `POST /questions/:id/answers` и фото `POST /questions/:id/answers/photo`. Никакого нового goal-level write-пути не вводим.
- Опции/лейблы типов вопросов берутся из единого конфига (`QUESTION_TYPES` на бэке / `question-types.ts` на фронте), не хардкодятся в инпутах.
- `answer` ≤ 200 символов (существующий `@MaxLength(200)` в `AnswerQuestionDto`) — текстовые инпуты не превышают.
- Фото: тип/размер не валидируем заново на фронте сверх UX-подсказки — бэк уже фильтрует (`image/*`, ≤10MB в `FileInterceptor`); фронт лишь даёт `accept="image/*"` и показывает ошибку бэка при отказе.

### Principles
- `GoalReportForm` самодостаточен и переиспользуем: вход — `goalId` + `date`, выход — `done`; ничего не знает про «очередь» или конкретную страницу.
- Fail fast: ошибку сохранения ответа показываем, не глотаем; при неуспехе не переходим к следующему вопросу/цели.
- FSD: формы и answer-inputs — в `features/goals/ui`; примитивы — реюз shadcn-vue из `components/ui`, без новых зависимостей.
- Бэкенд-эндпоинты узкие, read-only, переиспользуют `ScheduleService`/`ReportService`, не дублируют due-логику.
- Никаких новых способов хранения ответа — реюзаем существующие write-эндпоинты (текст + фото), новых write-путей не вводим.

## Plan

Approach: 5 фаз. Бэк — новый `GoalReportController` **внутри ReportModule** (там уже есть `ReportService` + транзитивно `GoalService`/`ScheduleService`; вешать на `GoalController` нельзя — `GoalModule` не импортит `ReportModule`, получился бы цикл). Два read-метода в `ReportService`. Фронт — answer-inputs (вкл. фото) → форма → две страницы → точки входа. Запись реюзит существующие `POST /questions/:id/answers` (текст) и `POST /questions/:id/answers/photo` (фото, multipart). **Фото-фича уже вмёржена (`329670b`) — бэк фото готов, на бэке ничего фото-специфичного не дописываем.** Phase 1 (report-status/queue) автоматически учитывает фото: `addPhotoAnswer` создаёт строку `report_answers`, поэтому фото-вопрос виден как answered той же `findByQuestionsAndDate`.

**Разрешённые в Plan unknowns:**
- Таймзона: фронт всегда шлёт явный `date` локальным `YYYY-MM-DD` (как существующий `toLocalISO`); бэк доверяет параметру, при отсутствии берёт server-local `new Date()` (тот же паттерн, что в `findLastUnfilledDate`). `User.timezone`-резолв не вводим — это отдельная задача и текущий код его не использует в этих путях.
- Источник опций answer-input: расширяем существующий `features/goals/ui/steps/question-types.ts` полем `options`, не плодим второй список. Формат строки-ответа держим в чистой утилите `features/goals/lib/answer-format.ts` (тестируемо).
- `emoji_rating` остаётся `"1".."5"` (бот-идентично). `EmojiRatingVisual` рисует это значение как текст — pre-existing-поведение, затрагивает и данные бота; **вне scope** (консистентность с историей бота важнее).

### Phase 1 — Backend: report-status + report-queue

- **1.1** `alfy-bot/src/modules/report/application/report.service.ts` (modify) — два метода:
  - `getGoalReportStatus(userId, goalId, date: string): Promise<GoalReportStatus>` — `findById`+owner-check (ForbiddenException), due-вопросы на дату через `scheduleService.isQuestionDueOnDateHistorical` (sort по `order_index`), answered через `answerRepo.findByQuestionsAndDate`. Возвращает `{ goalId, date, lastUnfilledDate, questions: QuestionReportItem[], allDone }`. `lastUnfilledDate` = `await this.findLastUnfilledDate(goalId)`. `allDone` = все обязательные (`!can_skip`) due-вопросы answered.
  - `getReportQueue(userId, date: string): Promise<ReportQueueItem[]>` — `goalService.findActiveByUser(userId)`, для каждой: `hasAnyQuestionDueToday`-аналог на дату + `getUnansweredQuestions(goal.id, date)`; включаем если есть unanswered; `pendingCount` = число unanswered. Зеркалит фильтр `offerNextGoal` (report.scene.ts:154-176), но параметризован датой.
  - Invariant: owner-check; due через `isQuestionDueOnDateHistorical`; read-only.
- **1.2** `alfy-bot/src/modules/report/dto/goal-report-status.dto.ts` (create) — `QuestionReportItemDto { questionId, question, type, can_skip, target_value, answered: boolean, answer_text, answer_number, answer_bool }`, `GoalReportStatusDto { goalId, date, lastUnfilledDate: string|null, questions: QuestionReportItemDto[], allDone: boolean }`, `ReportQueueItemDto { goalId, goalName, pendingCount }`. Swagger-декораторы как в соседних dto.
- **1.3** `alfy-bot/src/modules/report/report.controller.ts` (modify) — добавить в существующий `@Controller('questions')`? Нет — пути `goals/...`. Создать отдельный контроллер (1.4).
- **1.4** `alfy-bot/src/modules/report/goal-report.controller.ts` (create) — `@Controller('goals')`, `JwtOrApiTokenGuard`:
  - `GET :id/report-status?date?` → `getGoalReportStatus(req.user.sub, id, date ?? todayLocal())`
  - `GET report-queue?date?` → `getReportQueue(req.user.sub, date ?? todayLocal())`
  - **Порядок маршрутов:** статический `report-queue` объявить ДО параметрического `:id/...`? В Nest коллизии нет (`:id/report-status` vs `report-queue` — разные сегменты), но `GET goals/report-queue` не конфликтует с `GoalController` `GET goals/:id` т.к. разные контроллеры на одном префиксе — Nest матчит по полному пути; `report-queue` — литерал, безопасен. Проверить в Verify реальным запросом.
  - `todayLocal()` — приватный хелпер, `toLocalISO(new Date())`.
  - Invariant: owner-check внутри сервиса; `answer` write отсутствует здесь.
- **1.5** `alfy-bot/src/modules/report/report.module.ts` (modify) — добавить `GoalReportController` в `controllers`.
- Commit: `feat(reports): goal report-status and report-queue endpoints`

### Phase 2 — Frontend: API + answer-format util + types

- **2.1** `alfy-bot-frontend/src/api/reports.ts` (modify) — добавить:
  - `interface QuestionReportItem { questionId; question; type: QuestionType; can_skip; target_value?; answered; answer_text; answer_number; answer_bool }`
  - `interface GoalReportStatus { goalId; date; lastUnfilledDate: string|null; questions: QuestionReportItem[]; allDone }`
  - `interface ReportQueueItem { goalId; goalName; pendingCount }`
  - `fetchGoalReportStatus(goalId: number, date: string): Promise<GoalReportStatus>` → `GET /goals/:id/report-status?date=`
  - `fetchReportQueue(date: string): Promise<ReportQueueItem[]>` → `GET /goals/report-queue?date=`
  - `submitAnswer(questionId: number, scheduledDate: string, answer: string): Promise<void>` → `POST /questions/:id/answers { scheduled_date, answer }`
  - `submitPhotoAnswer(questionId: number, scheduledDate: string, file: File): Promise<void>` → `POST /questions/:id/answers/photo` через `FormData` (`photo`=file, `scheduled_date`). `Content-Type` ставит axios сам из FormData — **не** задавать вручную. (Реюз `fetchPhotoGallery` уже есть в reports.ts.)
- **2.2** `alfy-bot-frontend/src/features/goals/ui/steps/question-types.ts` (modify) — добавить `options?: (string|number)[]` к элементам: `rating`→`[1..5]`, `emoji_rating`→`['😕','😐','🙂','😊','🔥']`, `yes_no`→`['Да','Нет']`, `time_spent`→`['<30 мин','30-60','1-2ч','2+ч']`. `photo` — без options. (Зеркало бэкового `QUESTION_TYPES`.)
- **2.3** `alfy-bot-frontend/src/features/goals/lib/answer-format.ts` (create) — чистые функции маппинга UI-выбор → строка-ответ бота:
  - `ratingAnswer(n: number): string` → `String(n)`
  - `emojiRatingAnswer(index1based: number): string` → `String(index1based)` (НЕ эмодзи)
  - `yesNoAnswer(yes: boolean): string` → `yes ? 'yes' : 'no'`
  - `timeSpentAnswer(label: string): string` → `label`
  - `numberAnswer(raw: string): string`, `textAnswer(raw: string): string` → trimmed
  - Invariant: формат идентичен боту (см. Invariants).
- **2.4** `alfy-bot-frontend/src/types/index.ts` (modify) — экспортировать `QuestionType` уже есть; ничего не добавляем кроме переиспользования. (No-op если не нужно — удалить из плана при реализации.)
- Commit: `feat(goals): report API client + answer-format util`

### Phase 3 — Frontend: answer-input компоненты (вкл. фото)

- **3.1** `alfy-bot-frontend/src/features/goals/ui/answer-inputs/` (create) — по компоненту на тип. Текстовые: `emit('submit', answer: string)`. Фото: `emit('submitPhoto', file: File)`.
  - `RatingAnswerInput.vue` — 5 кнопок `1..5` (shadcn `Button`), клик → `submit(ratingAnswer(n))`
  - `EmojiRatingAnswerInput.vue` — кнопки с эмодзи из options, клик по i-й → `submit(emojiRatingAnswer(i+1))`
  - `YesNoAnswerInput.vue` — «Да»/«Нет» → `submit(yesNoAnswer(bool))`
  - `TimeSpentAnswerInput.vue` — кнопки лейблов → `submit(timeSpentAnswer(label))`
  - `NumberAnswerInput.vue` — `Input type=number` + кнопка «Ответить» → `submit(numberAnswer(v))`
  - `TextAnswerInput.vue` — `Textarea` (maxlength 200) + кнопка → `submit(textAnswer(v))`
  - `PhotoAnswerInput.vue` — `<input type="file" accept="image/*" capture>` (скрытый, кнопка-триггер «Выбрать фото»), превью выбранного через `URL.createObjectURL`, кнопка «Загрузить» → `submitPhoto(file)`. Локальная подсказка лимита (≤10MB), но без жёсткой валидации (бэк фильтрует). На `submitPhoto` родитель показывает спиннер (upload дольше текстового).
- **3.2** `alfy-bot-frontend/src/features/goals/ui/answer-inputs/AnswerInput.vue` (create) — роутер по `question.type` → нужный инпут (как `QuestionVisual`). Объявляет `emit('submit', string)` и `emit('submitPhoto', File)`, пробрасывает оба наверх. Для `type==='photo'` → `PhotoAnswerInput`, иначе текстовый инпут.
- Commit: `feat(goals): per-type answer input components`

### Phase 4 — Frontend: GoalReportForm + одиночная страница

- **4.1** `alfy-bot-frontend/src/features/goals/ui/GoalReportForm.vue` (create)
  - props `{ goalId: number; date: string }`, emit `done`
  - onMounted/`watch([goalId,date])`: `fetchGoalReportStatus(goalId, date)` → `status`
  - рендер: прогресс «N из M» по `questions.filter(!answered)`; текущий неотвеченный вопрос → `<AnswerInput :question @submit="onAnswer" @submitPhoto="onPhoto">`
  - `onAnswer(answer)`: `await submitAnswer(currentQ.questionId, date, answer)`; `onPhoto(file)`: `await submitPhotoAnswer(currentQ.questionId, date, file)`. Общий обработчик `advance(promise)`: на успехе — пометить answered/перейти к следующему; на ошибке — показать сообщение, НЕ продвигаться (fail-fast). Когда не осталось неотвеченных → `emit('done')`.
  - `submitting` ref → блокирует инпут и показывает спиннер во время await (важно для фото — медленный upload).
  - состояние loading/error; кнопка «Готово»/«Пропустить» для `can_skip`.
  - Invariant: запись только через `submitAnswer`/`submitPhotoAnswer` (существующие POST-эндпоинты); формат — через answer-inputs.
- **4.2** `alfy-bot-frontend/src/views/GoalReportView.vue` (create) — `route.params.id`, `date` = `route.query.date ?? todayLocalISO()`. `<AppHeader title="Отчёт по цели">` + `<GoalReportForm :goalId :date @done="onDone">`. По `done`: если `status.lastUnfilledDate` непуст и текущая дата=сегодня — предложить кнопкой дозаполнить (`router.replace({ query: { date: lastUnfilledDate }})` → форма перезагрузится на ту дату); иначе `router.push({ name:'goal', params:{id} })`.
  - Утилита даты: переиспользовать `src/utils/date.ts` или локальный `todayLocalISO()` (`toLocalISO`-эквивалент). Проверить наличие в `utils/date.ts` при реализации; если нет — добавить туда.
- **4.3** `alfy-bot-frontend/src/router/index.ts:54-58` (modify) — новый маршрут ПЕРЕД `questions/:id` и после `goals/:id`:
  - `{ path: 'goals/:id/report', name: 'goalReport', component: () => import('../views/GoalReportView.vue') }`
- **4.4** `alfy-bot-frontend/src/views/GoalView.vue` (modify, ~после заголовка/действий) — кнопка «Сделать отчёт по цели» → `router.push({ name:'goalReport', params:{ id } })`. Показывать для `goal.status === 'active'`.
- Commit: `feat(goals): GoalReportForm + single-goal report page`

### Phase 5 — Frontend: страница «все цели за сегодня» + вход

- **5.1** `alfy-bot-frontend/src/views/GoalsReportFlowView.vue` (create)
  - onMounted: `date = todayLocalISO()`; `queue = await fetchReportQueue(date)`; `index = 0`
  - если `queue` пуст → экран «Все отчёты на сегодня заполнены» + кнопка «К целям»
  - иначе `<GoalReportForm :goalId="queue[index].goalId" :date :key="queue[index].goalId" @done="next">`
  - `next()`: `index++`; если `index >= queue.length` → финальный экран; иначе следующая цель (`:key` форсит ремоунт формы)
  - заголовок с прогрессом «Цель k из N»
- **5.2** `alfy-bot-frontend/src/router/index.ts` (modify) — `{ path: 'goals/report-today', name: 'goalsReportToday', component: () => import('../views/GoalsReportFlowView.vue') }` — объявить ПЕРЕД `goals/:id` (иначе `:id` перехватит `report-today`).
- **5.3** `alfy-bot-frontend/src/views/HomeView.vue` (modify) — после загрузки целей подгрузить `fetchReportQueue(todayLocalISO())`; если непусто — кнопка «Заполнить отчёты за сегодня (N)» → `router.push({ name:'goalsReportToday' })`. Разместить рядом с «+ Создать цель» в шапке списка.
- Commit: `feat(goals): fill-all-goals-today report flow`

### Test strategy (TDD: yes)

Backend (jest, написать до реализации в Phase 1):
- `report.service.spec.ts` (modify) — `getGoalReportStatus`: помечает answered корректно; `allDone` true только когда все `!can_skip` due-вопросы отвечены; не-владелец → Forbidden; due-фильтр через historical schedule (вопрос не due на дату — отсутствует). `getReportQueue`: включает только цели с unanswered due; `pendingCount` верный; пустой список когда всё заполнено.
- Маршрутный smoke (`goal-report.controller.spec.ts`, create) — `GET goals/report-queue` не перехватывается `goals/:id`-роутом (резолвится в queue, не 404/ParseIntPipe-ошибку).

Frontend (vitest, написать до реализации):
- `tests/features/goals/answer-format.spec.ts` (create) — каждая функция даёт бот-идентичную строку: emoji_rating(3)→`'3'`; yesNo(true)→`'yes'`, yesNo(false)→`'no'`; rating(4)→`'4'`; timeSpent('1-2ч')→`'1-2ч'`.
- `tests/features/goals/GoalReportForm.spec.ts` (create) — MSW: рендерит первый неотвеченный вопрос; клик ответа шлёт `POST /questions/:id/answers` с верным `answer`; **photo-вопрос → выбор файла шлёт multipart `POST /questions/:id/answers/photo`** (проверить, что запрос ушёл; тело FormData в MSW можно не разбирать детально); после последнего → emit `done`; ошибка POST → не продвигается, показывает ошибку.
- `tests/features/goals/answer-inputs/*.spec.ts` (create, по 1 на нетривиальный инпут) — emit правильной строки; `PhotoAnswerInput` — выбор файла эмитит `submitPhoto` с `File`.

### Order & dependencies
- Phase 1 независима (бэк). Phase 2 независима (фронт util/api). Phase 3 зависит от 2 (answer-format). Phase 4 зависит от 2+3. Phase 5 зависит от 4 (GoalReportForm) + 2 (queue API). Исполнять последовательно 1→5.

### Backwards-compat
Greenfield: новые эндпоинты/контроллер, новый фронт-код, реюз существующих write-эндпоинтов (`POST :id/answers` + `POST :id/answers/photo`) и due-логики без изменений. Фото-фича вмёржена (`329670b`) — бэк/тесты фото не трогаем. Существующих потребителей `report-status`/`report-queue` нет. Единственный риск — роут-коллизия `goals/report-queue` vs `goals/:id` (бэк) и `goals/report-today` vs `goals/:id` (фронт-роутер): на фронте критично — статический путь объявить выше параметрического (5.2, 4.3); на бэке Nest различает литерал и параметр, но проверяем в Verify.

### Open questions / risks / rollback
- **Роут-коллизии** (выше) — главный риск; митигируется порядком объявления + Verify-проверкой реальным запросом.
- **`getReportQueue` N+1 по `getUnansweredQuestions`** — на одного юзера целей немного; приемлемо. Если станет проблемой — батч-запрос, вне scope.
- **Rollback**: каждая фаза — отдельный коммит, `git revert` точечно; БД-схема не меняется, откат code-only безопасен.

## Verify

**Result:** passed

Positive:
- BE unit `npm run test` → 296/296; FE `npm run test:run` → 240/240; оба `build` чисто; FE `vue-tsc --noEmit` чисто
- `getGoalReportStatus`: answered-маппинг, сортировка по order_index, `allDone` только по `!can_skip` due-вопросам — 6/6 (прогнаны в этом сообщении)
- `getReportQueue`: только цели с unanswered due, верный `pendingCount` — 2/2
- answer-format util (бот-идентичные строки: emoji→индекс, yes_no→`yes`/`no`) — 6/6
- Photo answer → строка `report_answers` с `photo_key` ⇒ считается answered тем же `findByQuestionsAndDate` (покрыто тестами `addPhotoAnswer`)

Negative:
- Не-владелец / несуществующая цель в `report-status` → Forbidden / NotFound (unit)
- `addPhotoAnswer` на не-photo тип → BadRequest; чужая цель → Forbidden (unit)

Invariants:
- Запись только через 2 существующих POST (`/questions/:id/answers`, `/questions/:id/answers/photo`); нового goal-level write-пути нет (grep `api.post` в reports.ts)
- Due на дату — через `isQuestionDueOnDateHistorical`; owner-check в обоих новых методах
- Статические маршруты до `:id` во фронт-роутере; на бэке — двухсегментный `goals/reports/queue`
- answer ≤200 (TextAnswerInput maxlength); photo `accept="image/*"`, эмитит File, шлёт FormData

Smoke: routing e2e (`web-goal-reports-routing.e2e-spec.ts`, реальный Nest-роутер, GoalController зарегистрирован первым = worst case) → `goals/reports/queue`, `goals/:id/report-status`, `goals/:id` резолвятся верно — 4/4.

Notes:
- **Найден и исправлен баг роут-коллизии** (тот самый риск из Plan): одиночный `goals/report-queue` перехватывался `GoalController @Get(':id')` → 400 (ParseIntPipe). Express 5 / path-to-regexp v8 отвергают inline-regex `:id(\d+)`; порядок контроллеров определяется import-порядком модулей (`GoalModule` до `ReportModule`). Фикс — двухсегментный путь `goals/reports/queue` (его не может захватить одиночный `:id`), `78ae0e7`, + e2e-регрессия.
- **Не запускался** полный HTTP-смоук против живого DB-сервера: full `AppModule` поднимает Telegram-бота и падает на `401: Bot Token is required` — pre-existing (так же падают `tasks.e2e-spec.ts`/`app.e2e-spec.ts` на baseline, не вводилось этой задачей). Компенсировано real-router routing e2e + сервис-уровневыми тестами данных.

## Conclusion

Outcome: веб-заполнение отчётов по целям (текст + фото) работает end-to-end — одиночный отчёт, последовательный проход по всем целям дня, переиспользуемый `GoalReportForm`. HEAD: `78ae0e7`.

Invariants:
- answer-строки бот-идентичны (emoji→1-based индекс, yes_no→`yes`/`no`, rating→число, time_spent→лейбл) — `answer-format.ts`, сверено с `question-ui.util.ts`; unit 6/6
- owner-check в обоих read-методах (`report.service.ts:235`, queue через `findActiveByUser`) — unit (Forbidden/NotFound)
- due через `isQuestionDueOnDateHistorical` во всех путях
- запись только через 2 существующих POST; новых goal-level write нет — grep `api.post` reports.ts
- опции типов из единого `question-types.ts`; photo `accept="image/*"`, text maxlength 200
- фото-вопрос считается answered (`answered = answer !== undefined`, `answer_text=''` проходит без спец-кейса)

Plan adherence: 4 минорных отклонения (ниже), все зафиксированы и подтверждены ревьюером как консистентные.

Review findings: чисто — независимый `up:reviewer` не нашёл находок ≥80; 3 ключевых утверждения (нет stale-пути, photo-маппинг без падения, fail-fast не продвигается на ошибке) перепроверены диспетчером против кода.

Verified by: routing e2e против реального Nest-роутера (worst-case порядок контроллеров). НЕ запускался полный HTTP-смоук против живого DB-сервера — full `AppModule` поднимает Telegram-бота и падает `401: Bot Token required` (pre-existing, так же `tasks.e2e-spec.ts` на baseline); компенсировано routing e2e + сервис-тестами.

### Deviations from plan
- Phase 1: `toLocalISO` извлечён из `report.service.ts` в новый `report/lib/date.ts` (одна точка истины), импортирован сервисом и `goal-report.controller.ts`. Pure-функция, без смены поведения; все 6 прежних вызовов переключены.
- Phase 4: `AnswerInput.vue` props сменены `{ question: Question }` → `{ type: QuestionType }` (предпочтительный вариант, явно одобренный планом — компонент использует только `type`; `report-status` отдаёт `QuestionReportItem`, не `Question`). Единственный потребитель — `GoalReportForm`.
- Phase 4: `GoalReportView.onDone` делает повторный read-only `GET report-status`, чтобы прочитать `lastUnfilledDate` (форма не экспонирует свой статус). Новых write-путей не вводит.
- Phase 5: кнопка на `HomeView` — `fetchReportQueue` обёрнут в локальный try/catch (фейл очереди → кнопка скрыта, список целей не ломается). Сознательная деградация второстепенной фичи, не маскировка бага.

### Hands-off decisions
<empty — populated only when Mode is hands-off>

### Deferred (needs user input)
<empty — populated only when Mode is hands-off and a choice had no conservative default>
