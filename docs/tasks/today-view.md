# Экран «Сегодня» в сайдбаре (просроченные + сегодняшние задачи)

**Status:** executing
**Branch:** feat/today-view
**Worktree:** /Users/v/projects/Alfy/.worktrees/feat-today-view
**Mode:** interactive

## Design

### Purpose & scope

Экран-«входная точка дня» по образцу Todoist: один список того, что требует внимания
сегодня — просроченное сверху, сегодняшнее следом. Сейчас такого среза нет: «Входящие»
показывают только задачи без проекта и без учёта дат, а календарь даёт сетку часов, а не
список дел.

В объёме (подтверждено с пользователем):
- Пункт «Сегодня» в сайдбаре задач между «Входящие» и «Календарь».
- Экран с двумя сворачиваемыми группами: «Просрочено» и «Сегодня».
- Счётчик задач бейджем у пункта сайдбара.
- Кнопка «Перенести» в шапке группы «Просрочено» — массовый перенос на сегодня.
- Инлайн-добавление задачи с предзаполненной датой «сегодня».

Вне объёма: «Предстоящее», пользовательские фильтры, drag-and-drop внутри экрана,
per-task быстрые действия переноса, изменения бэкенда.

### Chosen approach

**A — отдельный роут `/tasks/today` + `TodayView.vue` + чистая lib.**

Разбиение на группы живёт в `features/tasks/lib/today.ts` как чистая функция
`splitTodayBuckets(tasks, now) → { overdue, today }`. Её зовут и вью, и счётчик сайдбара,
поэтому бейдж «4» и заголовок «4 задачи» не могут разойтись.

Отклонённые варианты:
- **B — `TasksView` + `?scope=today`.** Паттерн `?scope=` в проекте живой (`goals-nav.ts`),
  но там это фильтр над тем же списком, а здесь другая раскладка. Решающий довод против:
  `useReorderList` держит индекс вставки по плоскому списку DOM-узлов `[data-task-id]`;
  группировка в том же компоненте ломает reorder во «Входящих».
- **C — обобщённый движок фильтров.** YAGNI: абстракция, выведенная из одного примера,
  переписывается на втором. Вернуться к ней, когда появится «Предстоящее».

### Семантика групп

Ключевое: `Task.isOverdue` — **не** «просрочена по дате». Это флаг «заморожена» для
повторяющихся задач с `onMissed: 'freeze'` (см. `docs/tasks/overdue-recurring-tasks.md`).
Такие задачи иммутабельны — `task.service.ts` кидает `BadRequestException` на любой PATCH.

- **«Просрочено»** = `!completed && !isOverdue && dueDate < начало сегодня`.
- **«Сегодня»** = `!completed && !isOverdue && dueDate ∈ [начало сегодня, конец сегодня]`.
- Замороженные (`isOverdue === true`) не показываются нигде на этом экране и не входят в
  счётчик — решение пользователя: «только актуальные, freeze не нужны». Экран остаётся
  списком действий: всё видимое можно перенести или закрыть.
- Задачи из **всех** проектов, не только Входящие — как в Todoist. `TaskCard` уже принимает
  `projectName` и рисует ярлык проекта.
- Границы дня — локальное время браузера (`startOfDay`/`endOfDay` из date-fns), без
  UTC-конверсий, по timezone-конвенции фронта в CLAUDE.md.

Виртуальные вхождения («призраки» повторяющихся задач из `calendar-events.ts`) на экран не
попадают: живой курсор серии — всегда реальная задача в сторе, призраки описывают только
будущие слоты за курсором.

### UI

Шапка `AppHeader` с заголовком «Сегодня» и подзаголовком «N задач». Меню параметров
списка на этом экране нет: выполненные не показываются никогда (закрыл задачу — она ушла из
«Сегодня», как в Todoist), а замороженных тут нет по построению. Это осознанно экономит
изменение общего `TaskListOptionsMenu`, который сейчас жёстко рендерит оба тоггла и нужен
«Входящим» и проектам как есть.

Две группы, каждая — заголовок + список `TaskCard` через `divide-y divide-border`, как в
`GroupedListView`. Заголовок группы «Просрочено» несёт кнопку-ссылку «Перенести» справа.
Заголовок группы «Сегодня» — дата в стиле скриншота («25 авг · Сегодня · Вторник»), через
`formatters.ts` + `useLocale`. Сворачивание — локальный `ref`, не персистится.

Пустые состояния: если обе группы пусты — «На сегодня задач нет»; если пуста только
«Просрочено» — группа не рендерится вовсе.

### Массовый перенос («Перенести»)

N независимых `PATCH /tasks/:id` через существующий `taskStore.updateTask` — нового
эндпоинта не заводим.

- Всегда `rescheduleScope: 'this'`. `useRecurringReschedule` для повторяющейся задачи
  показывает диалог «Сместить все последующие или только текущую?» — в массовой операции
  это N диалогов подряд. Переносим только конкретное вхождение; сдвиг серии остаётся
  ручным через карточку.
- **Время суток сохраняется**: «вчера 19:00» → «сегодня 19:00». Задача без времени
  (00:00) остаётся без времени.
- Частичный успех допустим: `Promise.allSettled`, о неудачах сообщаем в существующий
  `error` стора, молча не глотаем.
- Замороженные в выборку не попадают по построению (их нет в группе).

### Счётчик в сайдбаре

`tasksNavLinks` — статический массив на уровне модуля; `useTaskStore()` при его построении
вызвать нельзя, Pinia ещё не поднята. Поэтому `NavLink` получает опциональное
`count?: () => number` — тунк, который `SidebarNav` разворачивает внутри `computed` уже в
setup-контексте. Поле опционально, остальные секции (goals, habits) не затрагиваются.

Счётчик = `overdue.length + today.length`. Рендерится только при `> 0`, приглушённым числом
справа (тон `text-sidebar-foreground/50`, в одном ключе с заголовками секций сайдбара) —
это отдельный слот, существующий `badge` («скоро») остаётся строковым бейджем как был.

Данные: счётчик читает `taskStore.tasks`. Стор наполняется `fetchTasks()` из вью раздела
задач; `TodayView` зовёт его при монтировании так же, как `TasksView`. Пункты сайдбара
задач видны только внутри секции `tasks`, так что счётчик не показывается там, где стор
заведомо пуст.

### Backwards compatibility

Ломать нечего — чистое дополнение фронта:
- `NavLink.count` — опциональное поле, существующие ссылки не меняются.
- Новый роут `/tasks/today` — дочерний к `/tasks`, ничего не перехватывает.
- Новых эндпоинтов и изменений схемы нет; «Перенести» бьёт в существующий `PATCH /tasks/:id`.

### Unknowns

Нет. Все зависимости — существующий код фронта, поведение бэкенда по overdue проверено в
`task.service.ts` и покрыто его спеками.

TDD: yes (для `features/tasks/lib/today.ts` — чистая детерминированная логика разбиения и
подсчёта, регрессия в ней тихо ломает и экран, и счётчик; компоненты покрываются обычными
component-спеками после реализации)

### Invariants

- Разбиение на группы и число для счётчика вычисляет одна функция `splitTodayBuckets` из
  `features/tasks/lib/today.ts`; ни `TodayView`, ни `SidebarNav` не повторяют предикаты у себя.
- Задача с `isOverdue === true` не попадает ни в одну группу и не входит в счётчик.
- Массовый перенос никогда не отправляет PATCH для задачи с `isOverdue === true`.
- Массовый перенос всегда передаёт `rescheduleScope: 'this'`.
- Перенос сохраняет время суток исходного `dueDate`.
- `features/tasks/lib/today.ts` не импортирует Pinia, Vue и не читает часы: `tasks` и `now`
  приходят аргументами.
- `router/tasks-nav.ts` не обращается к сторам на уровне модуля.
- Границы дня считаются локальными методами даты, без UTC-конверсий.
- `TodayView` не подключает `useReorderList` и `useTaskDnd`.
- Выполненные задачи не отображаются на экране «Сегодня» ни при каких условиях.
- `TaskListOptionsMenu` не изменяется.
- `TasksView` (Входящие) не изменяется.

### Principles

- Fail loud: неудача части задач в массовом переносе доходит до пользователя, а не глотается
  в `catch`.
- Переиспользуем существующие компоненты (`TaskCard`, `TaskForm`, `AppHeader`,
  `PageContainer`) вместо параллельных копий.
- Даты и локаль — только через `formatters.ts` и `useLocale`, без хардкода `ru`.
- YAGNI: никакого обобщённого движка фильтров, пока фильтр один.

## Plan

Approach: снизу вверх — сначала чистая `today.ts` под тестами, потом экран, потом три
надстройки (prefill, массовый перенос, счётчик), каждая из которых трогает по одному общему
файлу и потому живёт в отдельном коммите.

### Phase 1 — Чистая логика разбиения (TDD)

- **1.1** `alfy-bot-frontend/tests/features/tasks/lib/today.spec.ts` (create) — пишется первым, падает
  - Стиль `tests/features/tasks/lib/active-tasks.spec.ts`: локальный `makeTask()`, `now` аргументом, никаких фейковых таймеров.
- **1.2** `alfy-bot-frontend/src/features/tasks/lib/today.ts` (create)
  - `export interface TodayBuckets { overdue: Task[]; today: Task[] }`
  - `export function splitTodayBuckets(tasks: Task[], now: Date): TodayBuckets` — единственное место с предикатами групп; обе группы отсортированы по `dueDate` по возрастанию.
  - `export function countTodayTasks(tasks: Task[], now: Date): number` — реализуется через `splitTodayBuckets`, не повторяет предикаты.
  - `export function shiftToSameTimeToday(dueDate: Date, now: Date): Date` — копия даты с подменёнными год/месяц/день на сегодняшние, время суток нетронуто.
  - Границы дня — `startOfDay`/`endOfDay` из `date-fns` (локальные методы). Invariant: без UTC-конверсий.
  - Invariant: модуль не импортирует Pinia/Vue и не читает часы.
- Commit: `feat(tasks): add today buckets split logic`

### Phase 2 — Экран и роут

- **2.1** `alfy-bot-frontend/src/views/TodayView.vue` (create)
  - Обвязка по образцу `views/TasksView.vue:1-140`: `useTaskStore`, `useTaskDetailHandlers`, `useConfirm`, `useTimerStore.startTask`, `getProjectName` через `projectStore.projectMap`, `fetchTasks()` в `onMounted`.
  - `const now = useNow()` → `const buckets = computed(() => splitTodayBuckets(tasks.value, now.value))` — экран пересобирается раз в минуту и переживает полночь.
  - `collapsedOverdue` / `collapsedToday` — локальные `ref(false)`, не персистятся.
  - Шапка: `AppHeader` (title «Сегодня», `on-menu-click="openSidebar"`), подзаголовок «N задач» внутри `PageContainer`. Слот `#right` не заполняем.
  - Заголовки групп в стиле `features/projects/ui/GroupedListView.vue:7-11`; список — `divide-y divide-border` + `TaskCard` с `:project-name`.
  - Заголовок группы «Сегодня» — `formatDate(now, 'd MMM')` + «Сегодня» + `formatDate(now, 'EEEE')` через `formatters.ts` (локаль тянется из `useLocale` внутри `formatDate`).
  - Группа «Просрочено» не рендерится при пустом `buckets.overdue`; обе пусты → «На сегодня задач нет».
  - Invariant: не подключает `useReorderList`/`useTaskDnd`; выполненные не отображаются (их отсекает `splitTodayBuckets`).
- **2.2** `alfy-bot-frontend/src/router/index.ts:41` (modify)
  - Новый дочерний роут между `''` и `calendar`: `{ path: 'today', name: 'tasks-today', component: () => import('../views/TodayView.vue') }`.
- **2.3** `alfy-bot-frontend/src/router/tasks-nav.ts:4-7` (modify)
  - Ссылка `{ to: '/tasks/today', label: 'Сегодня', icon: CalendarCheck }` между «Входящие» и «Календарь». Счётчик — в Phase 5.
  - Invariant: модуль по-прежнему не обращается к сторам.
- Commit: `feat(tasks): add Today view with overdue and today groups`

### Phase 3 — Предзаполненная дата в быстром добавлении

- **3.1** `alfy-bot-frontend/src/features/tasks/ui/TaskForm.vue:327-337,380-384` (modify)
  - `interface Props { loading?: boolean; defaultDueDate?: Date }`; `form.dueDate` инициализируется из `props.defaultDueDate`, `resetForm()` возвращает к нему же, а не к `undefined`.
  - Проп опционален и по умолчанию `undefined` — `TasksView` и `ProjectView` ведут себя ровно как сейчас.
- **3.2** `alfy-bot-frontend/src/views/TodayView.vue` (modify)
  - `<TaskForm :default-due-date="startOfToday()" ...>` внизу группы «Сегодня»; `handleAddTask` — копия из `TasksView.vue:88-101`.
- Commit: `feat(tasks): prefill due date in Today quick-add`

### Phase 4 — Массовый перенос «Перенести»

- **4.1** `alfy-bot-frontend/src/views/TodayView.vue` (modify)
  - `async function handleRescheduleOverdue(): Promise<void>` — `Promise.allSettled` по `buckets.overdue` с `updateTask(task.id, { dueDate: shiftToSameTimeToday(task.dueDate!, now.value), rescheduleScope: 'this' }, false)`; число `rejected` уходит в сообщение об ошибке на экране.
  - Кнопка «Перенести» в заголовке группы «Просрочено», справа, `variant="link"`; на время операции `disabled`.
  - Invariant: `rescheduleScope: 'this'` всегда; замороженных в `buckets.overdue` нет по построению, отдельной проверки не требуется.
  - Принцип fail loud: `allSettled`, а не `catch {}`.
- Commit: `feat(tasks): bulk reschedule overdue tasks to today`

### Phase 5 — Счётчик в сайдбаре

- **5.1** `alfy-bot-frontend/src/types/navigation.ts:3-9` (modify)
  - `count?: (now: Date) => number` — тунк, а не число: `tasksNavLinks` строится на уровне модуля, до подъёма Pinia. `now` аргументом, чтобы счётчик переживал полночь.
- **5.2** `alfy-bot-frontend/src/components/SidebarNav.vue:1-9,50-56` (modify)
  - `const now = useNow()`; `function linkCount(link: NavLink): number | null` — возвращает `null`, когда `count` не задан или вернул `0`.
  - Разметка счётчика — отдельный `<span v-if="linkCount(link) !== null" class="text-xs text-sidebar-foreground/50">`; существующий строковый `badge` («скоро») остаётся как есть.
- **5.3** `alfy-bot-frontend/src/router/tasks-nav.ts` (modify)
  - У ссылки «Сегодня»: `count: (now) => countTodayTasks(useTaskStore().tasks, now)` — `useTaskStore()` зовётся внутри тунка, то есть уже в setup-контексте `SidebarNav`.
- Commit: `feat(tasks): show today task count in sidebar`

### Test strategy

Phase 1 — тесты пишутся до реализации:
- `splitTodayBuckets`: вчерашняя живая задача → `overdue`; сегодня 00:00 и сегодня 23:59 → `today`; завтра 00:00 → никуда; `completed: true` с сегодняшней датой → никуда; `isOverdue: true` со вчерашней датой → никуда; без `dueDate` → никуда.
- `splitTodayBuckets`: задача с `projectId` попадает в группы наравне с inbox-задачей.
- `splitTodayBuckets`: обе группы отсортированы по `dueDate` по возрастанию.
- `countTodayTasks`: равен сумме длин групп на смешанном наборе.
- `shiftToSameTimeToday`: «вчера 19:30» → «сегодня 19:30»; «позавчера 00:00» → «сегодня 00:00»; исходный объект не мутируется.

Phases 2–5 — обычные component-спеки после реализации:
- `tests/views/TodayView.spec.ts`: рендерит обе группы; прячет «Просрочено» при пустой группе; показывает пустое состояние; «Перенести» зовёт `updateTask` по разу на задачу с `rescheduleScope: 'this'` и сегодняшней датой с сохранённым временем.
- `tests/components/SidebarNav.spec.ts` (создаётся): число рендерится при `count > 0` и отсутствует при `0` и при незаданном `count`.
- `tests/features/tasks/ui/TaskForm.spec.ts` (дополняется): `defaultDueDate` предзаполняет дату, `resetForm` возвращает к ней, а без пропа поведение прежнее.

### Order & dependencies

Phase 1 блокирует 2, 4 и 5 (все зовут `today.ts`). Phase 3 блокируется 2. Phases 3, 4, 5 между собой независимы.

### Backwards compatibility

Чистое дополнение фронта. Оба изменения общих контрактов — `NavLink.count` (5.1) и
`TaskForm.defaultDueDate` (3.1) — опциональные поля со значением по умолчанию `undefined`;
существующие места вызова не меняются и в диффе не появляются.

### Risks

- `SidebarNav` монтируется дважды — в десктопном `<aside>` и в мобильном `Teleport`
  (`AppSidebar.vue:124,160`), поэтому `useNow()` заведёт два минутных интервала. Совпадает с
  уже существующим поведением `CurrentTaskWidget` и задокументировано в CLAUDE.md; отдельно
  чинить не будем.
- Счётчик читает `taskStore.tasks`, который наполняет вью раздела; при холодном входе прямо
  на `/tasks/today` бейдж покажет пусто до конца `fetchTasks()`. Приемлемо — то же верно для
  `CurrentTaskWidget`.

## Verify
<empty — filled by up:uverify>

## Conclusion
<empty — filled by up:ureview>

### Deviations from plan

- Фазы реализованы inline, без диспатча `up:implementer` — в сессии стоит запрет на вызов сабагентов без явной просьбы пользователя.
- Добавлены `formatTaskCount` в `features/tasks/lib/formatters.ts` и спека к нему — план требовал подзаголовок «N задач», но склонения в проекте не было, а «1 задач» в шапке выглядит поломкой.
- В TodayView форма быстрого добавления показывается и в пустом состоянии (план подразумевал, что пустое состояние заменяет содержимое) — иначе с пустого «Сегодня» нельзя ничего добавить.
- На кнопку «Перенести» добавлен `data-testid="reschedule-overdue"` как якорь для спеки.

### Hands-off decisions
<empty — populated only when Mode is hands-off>

### Deferred (needs user input)
<empty — populated only when Mode is hands-off and a choice had no conservative default>
