# Автозакрытие задачи при выполнении всех помидоров

**Status:** done
**Branch:** feat/auto-complete-task-on-pomodoros-done
**Worktree:** /Users/v/projects/Alfy-worktrees/auto-complete-pomodoros
**Mode:** interactive

## Design

### Цель

Когда накопленное число помидоров по задаче достигает запланированного (`pomodoroCompleted >= pomodoroCount` — ровно то, что показывает бейдж `X/Y`), задача автоматически становится выполненной. В календаре она отображается как выполненная.

### Что уже есть (разведка)

- Единственный путь инкремента — `timer-store.incrementPomodoro()` (`alfy-bot-frontend/src/features/task-timer/model/timer-store.ts:157`) → `PATCH /tasks/:id/pomodoro`. Ни телеграм-бот, ни `alfy-mcp` помидоры не трогают.
- Инкремент дробный: `fraction = elapsed / phaseTime`, округлённый до сотых (`timer-store.ts:161-163`). `PomodoroConfig.pomodoroCompleted` — колонка `real`, накапливает дроби.
- `taskStore.incrementPomodoro` (`features/tasks/model/task-store.ts:197`) — **мёртвый код**, его никто не вызывает. Как следствие бейдж `X/Y` в списке не обновляется живьём, только после `fetchTasks()`.
- **Календарь уже умеет рисовать выполненное**: `features/calendar/lib/calendar-events.ts:24` берёт `completed: task.completed`, `CalendarEventBlock.vue:19` даёт зачёркивание + чекбокс. Отдельной работы по календарю не требуется — нужно лишь чтобы `task.completed` доехал до `task-store`.
- `pomodoroCount` сегодня используется только для отображения: таймер после N помидоров не останавливается, крутит фазы бесконечно.

### Выбранный подход (вариант A)

**Правило живёт на бэкенде**, потому что фронтовый `timer-store` вообще не знает накопленного `pomodoroCompleted` — у него только настройки сессии. Бэк — единственное место, где решение принимается по достоверным данным и переживает перезагрузку страницы / вторую вкладку.

Backend, `TaskService.incrementPomodoro`:

1. `findById` (эагерно тянет `pomodoroConfig`) → снимок `before` и `target`.
2. Атомарный `repo.incrementPomodoroCompleted(taskId, increment)` — как сейчас.
3. Перечитать задачу → авторитетный `after`. Перечитывание нужно в любом случае, чтобы вернуть клиенту свежий `pomodoroCompleted` для живого бейджа.
4. Чистый предикат `shouldAutoComplete({ before, after, target })` в новом `task/domain/pomodoro.utils.ts` (по образцу `recurrence.utils.ts` — домен, без зависимостей фреймворка).
5. Если предикат сработал — вызвать **существующий** `this.update(userId, taskId, { completed: true })`. Это тот же путь, что у ручной галочки: для повторяющихся задач автоматически отрабатывает `completeRecurringTask` (новый инстанс с `pomodoroCompleted = 0`, инкремент `recurringCompletedCount`). Второй ветки логики завершения не появляется.
6. Эндпоинт `PATCH /tasks/:id/pomodoro` начинает возвращать `UpdateTaskResponse` (`{ task, nextInstance? }`) — ту же форму, что и `PATCH /tasks/:id`.

Frontend:

- `task-store.incrementPomodoro` оживает: оптимистичный бамп (как сейчас), затем разбор ответа тем же кодом, что и в `updateTask` (общий хелпер применения `{ task, nextInstance?, deletedInstanceId? }` к стору вместо копипасты). При ошибке — откат бампа, как сейчас.
- `timer-store.incrementPomodoro` перестаёт ходить в API сам и делегирует в `taskStore.incrementPomodoro(taskId, fraction)`. Кросс-фичевого цикла импортов это не создаёт: `tasks/model/task-store.ts` из `task-timer` ничего не тянет (обратный импорт есть только на уровне `tasks/ui` → `task-timer`).
- Календарь не трогаем.

### Решения и что их закрыло

- **Порог — на накопленной дробной сумме**, а не на числе доведённых до конца помидоров. Это ровно то, что видит пользователь в бейдже `X/Y`, и не требует нового поля в БД.
- **Повторяющиеся задачи закрываются так же, как галочкой.** Альтернатива (не автозакрывать recurring) породила бы непоследовательное поведение, которое пришлось бы объяснять в UI.
- **Таймер после автозакрытия продолжает цикл фаз** — решение пользователя. Задача просто помечается выполненной; работать сверх плана не запрещаем. Правило перехода (ниже) гарантирует, что она не перезакроется.
- **Триггер по переходу, а не по факту «выше порога».** `before < target && after >= target`. Даёт бесплатный escape-hatch: снял галочку вручную → продолжай работать, задача сама не перезакроется.
- **Бэкфилла нет.** Задачи, уже стоящие на `4/4` и незакрытые, ретроспективно не закрываются. Ретроактивное закрытие чужих задач миграцией — сюрприз, которого не просили.

### Известные следствия (принято)

- Если уменьшить `pomodoroCount` с 8 до 2, будучи на `4.0`, — автозакрытия не будет: порог уже пройден, перехода нет.
- Инкремент и перечитывание не обёрнуты в транзакцию. При двух одновременно тикающих вкладках теоретически возможна гонка на определении перехода. Пользователь один, инкремент раз в ~25 минут — цена транзакции в SQLite того не стоит. Если понадобится — отдельная задача.

### Обратная совместимость

- `PATCH /tasks/:id/pomodoro` меняет пустое тело на `UpdateTaskResponse`. Аддитивно: единственный существующий потребитель (`timer-store`) тело игнорирует, внешних потребителей нет (грепом проверены `alfy-mcp` и модуль телеграма).
- Миграция схемы не нужна — переиспользуется существующее поле `Task.completed`.

### Неизвестные

- Есть ли на фронте существующие тесты `task-store` — уточняется на этапе Plan (`alfy-bot-frontend/tests/features/tasks/`).

TDD: yes (детерминированный предикат порога с нетривиальными краями: дроби, переход, отсутствие конфига, `pomodoroCount = 0`, уже выполненная задача, `isOverdue`, повторяющиеся; есть куда встроиться — `task.service.spec.ts` уже содержит `describe('incrementPomodoro')`).

### Invariants

- Автозакрытие срабатывает **только на переходе через порог**: `before < target && after >= target`. Инкремент при уже пройденном пороге задачу не перезакрывает.
- Автозакрытие идёт исключительно через `TaskService.update(userId, id, { completed: true })`. Отдельной ветки завершения — в том числе для повторяющихся задач — не появляется; `completeRecurringTask` не дублируется.
- Правило не срабатывает, если выполнено любое из: нет `pomodoroConfig`; `pomodoroCount <= 0`; задача уже `completed`; `task.isOverdue`.
- Сравнение с порогом устойчиво к float-дребезгу (эпсилон при сравнении, накопление идёт через SQL `x = x + n` по `real`).
- Предикат порога — чистая функция в `alfy-bot/src/modules/task/domain/pomodoro.utils.ts`, без импортов NestJS/TypeORM.
- `PATCH /tasks/:id/pomodoro` отдаёт ту же форму ответа, что и `PATCH /tasks/:id` — `UpdateTaskResponse`.
- На фронте HTTP-вызов `/tasks/:id/pomodoro` существует ровно в одном месте — `task-store.incrementPomodoro`. `timer-store` в этот эндпоинт напрямую не ходит.
- Инкремент уходит на бэкенд даже если задачи нет в локальном `task-store` (например, `restoreSession` отработал раньше `fetchTasks`). Текущий guard `if (!task || !task.isPomodoroTask) return` не должен превратиться в тихую потерю инкремента.
- Календарь новой логики не получает: `CalendarEvent.completed` по-прежнему выводится из `task.completed`.
- `alfy-mcp` и модуль телеграм-бота в этой задаче не изменяются.

### Principles

- Инкремент — первичный эффект и не должен теряться из-за автозакрытия: путь автозакрытия защищён guard'ами так, чтобы не бросать после уже сохранённого инкремента.
- Fail loud, без тихих фолбэков: ошибку эндпоинта фронт откатывает и логирует, а не проглатывает.
- Переиспользовать существующие пути, а не добавлять параллельные: одна семантика завершения задачи, один разбор `UpdateTaskResponse` на фронте.
- YAGNI: ни нового поля в БД, ни миграции, ни изменений в поведении таймера.

## Plan

Approach: чистый предикат порога в `task/domain/`, вызывающий его `TaskService.incrementPomodoro` делегирует закрытие существующему `this.update(..., { completed: true })`; фронт получает `UpdateTaskResponse` и применяет его тем же кодом, что и обычный апдейт задачи.

### Phase 1 — Backend: предикат порога + автозакрытие в сервисе

- **1.1** `alfy-bot/src/modules/task/domain/pomodoro.utils.spec.ts` (create) — **пишется первым, красный** (TDD: yes)
  - Покрытие `hasCrossedPomodoroTarget` — см. Test strategy.
- **1.2** `alfy-bot/src/modules/task/domain/pomodoro.utils.ts` (create)
  - `export const POMODORO_EPSILON = 1e-6`
  - `export function hasCrossedPomodoroTarget(before: number, after: number, target: number): boolean` — `target > 0 && before < target - POMODORO_EPSILON && after >= target - POMODORO_EPSILON`
  - Invariant: триггер только на переходе; устойчивость к float-дребезгу; чистая функция без импортов NestJS/TypeORM (по образцу `recurrence.utils.ts`).
- **1.3** `alfy-bot/src/modules/task/task.service.ts:273-281` (modify) — `TaskService.incrementPomodoro`
  - Сигнатура: `incrementPomodoro(userId: number, taskId: string, increment: number): Promise<UpdateTaskResponse>` (было `Promise<void>`).
  - Снять `before = task.pomodoroConfig?.pomodoroCompleted ?? 0` и `target = task.pomodoroConfig?.pomodoroCount ?? 0` до инкремента; `findById` эагерно тянет `pomodoroConfig`.
  - После `taskRepo.incrementPomodoroCompleted` — повторный `findById` за авторитетным `after`; при `null` откатиться на исходный `task`.
  - Автозакрытие при `!!task.pomodoroConfig && !task.completed && !task.isOverdue && hasCrossedPomodoroTarget(before, after, target)` → `return this.update(userId, taskId, { completed: true })`.
  - Иначе `return { task: refreshed }`.
  - Invariant: единственный путь завершения — `this.update`; `completeRecurringTask` не дублируется; guard'ы на `isOverdue` / отсутствие конфига / `pomodoroCount <= 0` / уже выполненную; путь автозакрытия не бросает после уже сохранённого инкремента.
- **1.4** `alfy-bot/src/modules/task/task.controller.ts:159-167` (modify) — `TaskController.incrementPomodoro`
  - `return this.taskService.incrementPomodoro(...)` с типом `Promise<UpdateTaskResponse>` вместо `await` + пустого ответа.
  - Invariant: та же форма ответа, что у `PATCH /tasks/:id`.
- **1.5** `alfy-bot/src/modules/task/task.service.spec.ts:289-318` (modify) — расширить `describe('incrementPomodoro')`
- **1.6** `alfy-bot/test/tasks.e2e-spec.ts` (modify) — блок `PATCH /api/tasks/:id/pomodoro`
- Commit: `feat(task): auto-complete task when pomodoro target is reached`

### Phase 2 — Frontend: живой инкремент через task-store

- **2.1** `alfy-bot-frontend/src/features/tasks/model/task-store.ts:95-164` (modify) — `updateTask`
  - Извлечь строки 122-150 в приватный `applyUpdateResponse(response: Record<string, unknown>, taskId: string): Task` — разбор `{ task, nextInstance?, deletedInstanceId? }` и патч стора (сохранение локального `checklist`, upsert `nextInstance`, удаление `deletedInstanceId`). `updateTask` начинает звать его.
  - Invariant: один разбор `UpdateTaskResponse` на фронте, без копипасты.
- **2.2** `alfy-bot-frontend/src/features/tasks/model/task-store.ts:197-209` (modify) — `incrementPomodoro`
  - Убрать guard `if (!task || !task.isPomodoroTask) return` — запрос уходит, даже если задачи нет в локальном сторе; оптимистичный бамп делается только когда задача найдена.
  - Откат хранить как снятое значение `pomodoroCompleted`, не вычитанием (float-дрейф).
  - Ответ прогонять через `applyUpdateResponse`; при ошибке — откат + `console.error`, как сейчас.
  - Invariant: единственный HTTP-вызов `/tasks/:id/pomodoro` на фронте; инкремент не теряется тихо.
- **2.3** `alfy-bot-frontend/src/features/task-timer/model/timer-store.ts:157-172` (modify) — `incrementPomodoro`
  - Убрать `api.patch`; вместо него `await useTaskStore().incrementPomodoro(taskId, fraction)`. `useTaskStore()` вызывается внутри функции (Pinia-идиома, без проблем с порядком активации). Guard `if (fraction <= 0) return` остаётся. `try/catch` уходит — обработка ошибки теперь в task-store.
  - Импорт `import { useTaskStore } from '@/features/tasks/model/task-store'`. Цикла не возникает: `tasks/model/task-store.ts` тянет только `@/api/client`, `./types`, `../lib/dateTime`.
  - Invariant: `timer-store` в `/tasks/:id/pomodoro` напрямую не ходит.
- **2.4** `alfy-bot-frontend/tests/features/tasks/model/task-store-pomodoro.spec.ts` (create) — по образцу `task-store-move.spec.ts` (`vi.mock('@/api/client')` + `setActivePinia`)
- **2.5** `alfy-bot-frontend/tests/features/task-timer/timer-store-pomodoro.spec.ts` (create)
- Commit: `feat(tasks): apply pomodoro increment response to task store`

Календарь не изменяется — `CalendarEvent.completed` уже выводится из `task.completed`.

### Test strategy

TDD: yes — 1.1 пишется до 1.2, остальные тесты идут вместе со своей фазой.

`pomodoro.utils.spec.ts`:
- `3.0 → 4.0`, target 4 → true (полный переход)
- `3.6 → 4.1`, target 4 → true (дробный переход)
- `3.0 → 3.6`, target 4 → false (не дошёл)
- `4.0 → 5.0`, target 4 → false (уже был на пороге — escape-hatch после ручного снятия галочки)
- `5.0 → 6.0`, target 4 → false (уже был выше)
- target `0` → false
- `3.9 → 3.9999999`, target 4 → true (float-дребезг снизу)
- `3.9999999 → 4.5`, target 4 → false (float-дребезг на пороге)

`task.service.spec.ts` → `describe('incrementPomodoro')` (три существующих теста сохраняются):
- пересечение порога → `save` с `completed: true`, в ответе `task.completed === true`
- задача уже `completed` → повторно не закрывается
- `isOverdue` → не закрывается и не бросает
- нет `pomodoroConfig` → не закрывается
- порог не достигнут → `{ task }` со свежим `pomodoroCompleted`, `completed` не менялся
- recurring пересёк порог → `repo.create` вызван, `nextInstance` в ответе, у него `pomodoroCompleted === 0`

`tasks.e2e-spec.ts` (реальный SQLite — покрывает и форму ответа, и накопление в БД):
- создать задачу с `pomodoroCount: 2` → два `PATCH .../pomodoro { increment: 1 }` → первый ответ `task.completed === false`, второй `true`
- третий инкремент по той же задаче не роняет запрос и не меняет `completed`

`task-store-pomodoro.spec.ts`:
- оптимистичный бамп `pomodoroCompleted` до ответа
- `PATCH /tasks/task-1/pomodoro` с `{ increment }`
- ответ `{ task: { completed: true, pomodoroConfig: {...} } }` → в сторе `completed === true` и свежий `pomodoroCompleted`
- `nextInstance` в ответе → появляется в сторе
- ошибка API → `pomodoroCompleted` откатывается к исходному
- задачи нет в сторе → запрос всё равно отправлен (инвариант)

`timer-store-pomodoro.spec.ts`:
- `stopTimeBlock()` на рабочей фазе → `taskStore.incrementPomodoro` вызван с `(taskId, fraction)`
- `api.patch` на `/tasks/:id/pomodoro` не вызывается
- фаза перерыва → инкремента нет

### Order & dependencies

Phase 1 → Phase 2: фронт-тесты мокают форму ответа, которую вводит Phase 1. Внутри Phase 2: 2.1 блокирует 2.2, 2.2 блокирует 2.3.

### Backwards compatibility

- `PATCH /tasks/:id/pomodoro`: пустое тело → `UpdateTaskResponse` (Phase 1.4). Аддитивно, потребитель один и он в этой же задаче переводится на новый ответ. Внешних потребителей нет — грепом проверены `alfy-mcp/src` и модуль телеграма.
- Миграции схемы нет; бэкфилла по решению Design нет.

### Open questions / risks / rollback

- `timer-store.incrementPomodoro` не входит в возвращаемый объект стора, поэтому тестируется только через `stopTimeBlock()`, который дёргает `useSounds` и `sendToSW`. Оба безопасны в happy-dom (`new Audio` в try/catch; `sendToSW` выходит по guard'у при отсутствии `navigator.serviceWorker`), но если тест окажется хрупким — экспортировать `incrementPomodoro` из стора. Не делать это превентивно.
- Инкремент и перечитывание не в транзакции — принято в Design; при двух тикающих вкладках возможна гонка на определении перехода.
- Rollback: обе фазы — отдельные коммиты, откатываются независимо; при откате только Phase 2 бэкенд продолжит закрывать задачи, фронт увидит это после `fetchTasks`.

## Verify

**Result:** passed

Прогонялось в worktree `/Users/v/projects/Alfy-worktrees/auto-complete-pomodoros` на `9a7b4b6`.

Positive:
- backend unit 349/349, e2e 31/31, frontend 51 файл / 321 тест, `vue-tsc` чисто
- предикат: полный переход, дробный переход, float-дребезг снизу
- сервис: пересечение порога закрывает задачу; recurring порождает `nextInstance` с `pomodoroCompleted = 0`
- фронт: ответ с `completed: true` применяется к стору; `nextInstance` попадает в стор

Negative:
- порог не достигнут → счётчик свежий, `completed` не менялся
- уже выполненная / `isOverdue` / без `pomodoroConfig` / `target = 0` → не закрывается, не бросает
- ошибка API → оптимистичный бамп откатывается к снимку
- фаза перерыва → инкремент не пишется

Invariants:
- `/tasks/:id/pomodoro` вызывается ровно из одного места на фронте — `task-store.ts:215`
- `pomodoro.utils.ts` не имеет ни одного импорта
- автозакрытие идёт только через `this.update(..., { completed: true })`, второй ветки завершения нет
- инкремент уходит на бэк и когда задачи нет в локальном сторе
- `features/calendar`, `alfy-mcp`, `modules/bot` в диффе обеих фаз отсутствуют

Smoke: живой сервер на :3099 (отдельная БД), реальные curl —
`pomodoroCount=2`: +1 → `completed:false, done:1`; +1 → `completed:true, done:2`.
Escape-hatch: снять галочку → +1 → `completed:false, done:3` (не перезакрывается).
Дробное: `pomodoroCount=1`, +0.5 → открыта; +0.5 → `completed:true`.
Recurring daily: +1 → `completed:true` + `nextInstance` на следующий день, `pomodoroCompleted=0`, `recurringParentId` проставлен.
Без конфига: +5 → `completed:false`.

Notes:
- В worktree нет untracked `.env`, поэтому e2e и smoke запускались с подставными `SMTP_*` / `BOT_TOKEN` / `JWT_SECRET` в командной строке. Копирование реального `.env` с секретами намеренно не делалось.
- Полный `npm run test:e2e` в worktree не завершается сам из-за открытых хендлов в teardown (тесты при этом проходят) — прогонялось с `--forceExit`. В основном дереве с настоящим `.env` завершается штатно, так что это свойство подставного окружения, а не регрессия.
- Фронтовый lint даёт 1913 проблем по всему репозиторию (стилевые правила `perfectionist`/`antfu`, нарушены и в нетронутых файлах вроде `vitest.config.ts`). По двум изменённым файлам: 82 → 81, то есть долга не добавлено. Приводить два файла к стандарту, который нарушают остальные 49, не стал.

## Conclusion

Outcome: помидоро-задача автозакрывается на переходе через `pomodoroCount`, и это доезжает до стора и календаря — `24e2d8c` (backend), `9a7b4b6` (frontend).

Invariants:
- триггер только на переходе — предикат `hasCrossedPomodoroTarget`, 8 юнит-кейсов + живой smoke: после ручного снятия галочки третий помидор задачу не перезакрыл
- завершение только через `this.update(..., { completed: true })` — прочитано в диффе, второй ветки нет; smoke на recurring дал `nextInstance` со сброшенным счётчиком, то есть отработал существующий `completeRecurringTask`
- guard'ы `isOverdue` / нет конфига / `target <= 0` / уже выполненная — по тесту на каждый, плюс smoke на задаче без конфига
- устойчивость к float — кейсы с обеих сторон порога; smoke: `0.5 + 0.5` при цели 1 закрывает
- предикат без зависимостей фреймворка — в `pomodoro.utils.ts` ноль импортов
- один HTTP-вызов `/tasks/:id/pomodoro` на фронте — грепом по `src`, единственное вхождение `task-store.ts:215`
- инкремент не теряется, если задачи нет в сторе — отдельный тест на отправку запроса при пустом сторе
- календарь, `alfy-mcp`, `modules/bot` не изменялись — их нет в `git diff --name-only 5e4c4bb..HEAD`

Plan adherence: два отклонения, оба зафиксированы ниже в `### Deviations from plan` — починка e2e-харнесса и трёх стухших ассертов. Оба вне первоначального плана, оба потребовались чтобы Phase 1.6 вообще была проверяема.

Review findings:
- Minor: `previousCompleted` в `task-store.ts` означал булев `completed` (строка 176) и число `pomodoroCompleted` (строка 208) одновременно. Переименовано в `previousPomodoroCompleted`.
- Ревью инлайновое, без независимого `up:reviewer`: окружение сессии запрещает диспатч субагентов без явной просьбы пользователя. Независимость стадии слабее, чем предполагает скилл.

Future work:
- `alfy-mcp/src/tools/tasks.ts:128,142` отдают клиенту `UpdateTaskResponse` целиком (`{task: {...}}`) вместо задачи. Найдено consistency-sweep'ом по тем же стухшим ассертам. Justification: инвариант задачи — «`alfy-mcp` и модуль телеграм-бота не изменяются». Пре-существует с задачи про recurring, влияние косметическое.
- У `PATCH /tasks/:id/pomodoro` нет DTO: `@Body() body: { increment: number }` — тип, а не класс, поэтому глобальный `ValidationPipe` его не проверяет и нечисловой либо отсутствующий `increment` уходит в TypeORM `increment()` без валидации. Justification: новый факт, всплывший на ревью; пре-существует, но диff повысил цену эндпоинта — он теперь переключает `completed`. Ложного автозакрытия не даёт (сравнение с `NaN` всегда false), но счётчик испортить может.

Verified by: живой сервер на :3099 с отдельной БД и реальными curl — подробности в `## Verify`. Полный e2e в worktree требует `--forceExit` и подставных env-переменных, потому что untracked `.env` в worktree отсутствует.

### Deviations from plan

- Добавлены `alfy-bot/test/setup-e2e-env.ts` + `setupFiles` в `test/jest-e2e.json` — план их не предусматривал. Без них Phase 1.6 непроверяема: `app.module.ts` вычисляет `isTelegramEnabled()` во время импорта модуля, а `test/helpers/test-app.ts:29` выставляет `ENABLE_TELEGRAM=false` только внутри `createTestApp()`, то есть уже после импорта. Telegraf стартовал и валил каждый suite, использующий `createTestApp`, с `401: Bot Token is required`. Было 4 из 31 проходящих e2e, стало 31 из 31.
- Задача переехала в worktree `/Users/v/projects/Alfy-worktrees/auto-complete-pomodoros` между Phase 1 и Phase 2. Причина внешняя: в основном дереве `/Users/v/projects/Alfy` кто-то застэшил незакоммиченную Phase 2 (`stash@{0}`, «wip pomodoro frontend») и переключился на `feat/reschedule-recurring-this-vs-series`, где идёт параллельная работа. Ничего не потеряно — Phase 1 была в коммите `24e2d8c`, Phase 2 восстановлена из стэша в worktree.
- Починены три стухших ассерта в `tasks.e2e-spec.ts` (`PATCH /api/tasks/:id`): `body.title` / `body.completed` / `body.dueDate` → `body.task.*`. Эндпоинт возвращает `UpdateTaskResponse` со времён задачи про recurring; тесты просто никогда не доходили до ассертов из-за поломки выше. Этот эндпоинт задачей не затрагивался.

### Hands-off decisions
<empty — populated only when Mode is hands-off>

### Deferred (needs user input)
<empty — populated only when Mode is hands-off and a choice had no conservative default>
