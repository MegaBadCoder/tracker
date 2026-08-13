# Виджет «Текущая задача» в сайдбаре

**Status:** executing
**Branch:** feat/sidebar-current-task-widget
**Worktree:** /Users/v/projects/Alfy-worktrees/sidebar-current-task-widget
**Mode:** interactive

## Design

### Цель

Блок «Текущая задача» в сайдбаре секции задач: показывает задачи, чьё временное окно содержит текущий момент, и для помидорных даёт кнопку запуска таймера. Отвечает на вопрос «чем я сейчас занят» без перехода в календарь.

### Что уже есть (разведка)

- `sectionExtraRegistry` в `components/AppLayout.vue:24-26` — реестр «секция → **один** компонент», сейчас `tasks` → `ProjectTreeNav` (подключён через `defineAsyncComponent`, строки 11-13). `AppSidebar.vue` пробрасывает результат в **два** слота `section-extra`: десктопный `<aside>` (строка 125) и мобильную панель в `<Teleport>` (строка 161).
- Все три роута секции (`/tasks`, `/tasks/calendar`, `/tasks/project/:id`) сами вызывают `fetchTasks()`. Виджет может быть пассивным читателем `taskStore.tasks` — свой запрос не нужен.
- `computeTaskDurationMinutes` (`features/tasks/lib/duration.ts`) для помидоро-задач возвращает `count*duration + перерывы`. Сверено со скриншотом пользователя: Гитара 11:35 + 2×25 + 5 = 12:30.
- Маппинг задачи в аргумент `startTask` продублирован в `views/TasksView.vue:118` и `features/tasks/ui/TaskDetailDialog.vue:679`, оба с инлайновыми `25/5/15/4` вместо существующего `POMODORO_DEFAULTS`.
- `HourGrid.vue:160-190` держит собственный `setInterval(60_000)` для красной линии. Общего композабла «сейчас» в проекте нет.
- `timer-store` не экспортирует `currentSettings` — снаружи не видно, по какой задаче идёт таймер. При выбранном поведении кнопки это и не требуется.

### Выбранный подход

**Компонент-обёртка вместо изменения механизма реестра.** Новый `TasksSidebarSection.vue` рендерит `<CurrentTaskWidget />`, затем `<ProjectTreeNav />`; в `AppLayout.vue` ключ `tasks` начинает указывать на него — правка одного значения, тип `Record<string, Component>` и шаблон не меняются. Альтернатива — научить реестр массиву компонентов — переделывает общий механизм ради единственного потребителя (`sectionExtra` есть только у `tasks`). Обёртка автоматически закрывает оба слота, включая мобильный. Ленивая загрузка сохраняется: `defineAsyncComponent` переезжает на обёртку, дети импортируются в ней статически — один чанк вместо одного, как и было.

Состав:

- `features/tasks/lib/active-tasks.ts` — чистая `getActiveTasksAt(tasks, now)`. Оконная арифметика вынесена из компонента, иначе её не протестировать.
- `composables/useNow.ts` — реактивное «сейчас» с минутным тиком.
- `features/task-timer/lib/to-timer-task.ts` — единый `toTimerTask(task)`; оба существующих места переводятся на него.
- `features/tasks/ui/CurrentTaskWidget.vue` — сам блок.
- `components/TasksSidebarSection.vue` — обёртка.

**Окно активности:** `start = task.dueDate`, `end = start + computeTaskDurationMinutes(task)`, активна при `start <= now < end`. Из выборки исключаются задачи без `dueDate`, выполненные, `isOverdue`, и all-day — задача с временем ровно `00:00` считается all-day, ровно как в `calendar-events.ts:13`, и нулевого окна у неё нет. Порядок — по времени начала.

**UI:** заголовок «Текущая задача» в стиле существующего «ПРОЕКТЫ» (`text-[11px] uppercase tracking-wide`), строки с названием задачи, у помидорных — кнопка `Play` (lucide). Клик по строке ничего не делает.

### Решения и что их закрыло

- **Строгое окно, без люфта вперёд.** Ровно то, что пересекает красная линия календаря. Люфт потребовал бы параметра N и размывал бы смысл слова «текущая».
- **Все активные задачи списком.** Длинная фоновая задача (`Рабочая сессия` 15:45–19:35) не должна исчезать из-за короткой внутри неё. Пересечения редки, поэтому обычно список — из одной строки, как на рисунке.
- **Не-помидорные показываем без кнопки.** Виджет отвечает на «чем я занят», а не «что можно запустить»; кнопка — бонус там, где она осмысленна.
- **Пустой список прячет виджет целиком.** Бо́льшую часть суток активных задач нет, и постоянный пустой блок занимал бы место зря.
- **Только реальные задачи из стора, без `tasksToCalendarEvents`.** Виртуальный инстанс повторяющейся задачи имеет id `id__virtual__ts`, которого нет на бэке: первый же инкремент помидора упал бы с 404. Отсечение на уровне источника данных надёжнее, чем флаг `isVirtual`, который надо не забыть проверить.
- **Кнопка перебивает идущий таймер.** Ровно так уже работают кнопки в списке задач и в карточке — нового поведения не вводим, `currentSettings` из стора выставлять не нужно.
- **Виджет над списком проектов.** Заметнее, и длинный список проектов не выталкивает его за экран.
- **`toTimerTask` выносится, оба существующих места переводятся.** Иначе виджет становится третьей копией маппинга. Значения инлайновых дефолтов совпадают с `POMODORO_DEFAULTS`.

### Известные следствия (принято)

- Минутный тик даёт задержку до 59 секунд. Столько же у красной линии календаря — рассогласования между ними не будет.
- В зазоре между смежными задачами (12:30–12:40 на скриншоте) виджет исчезает, и список проектов подпрыгивает вверх.
- Повторяющаяся задача с `dueDate` в прошлом, для которой календарь рисует призрак на сегодня, в виджет не попадёт. Это прямое следствие решения брать только реальные задачи.

### Обратная совместимость

Фронтенд-онли, ни API, ни схема не меняются.

- Значение `sectionExtraRegistry.tasks` меняется с `ProjectTreeNav` на обёртку. Потребитель один — `AppLayout.vue:56`. `tests/components/AppLayout.spec.ts` мокает `AppSidebar` целиком и гоняет только роуты `habits`, слот `section-extra` не затрагивает.
- Перевод `TasksView` и `TaskDetailDialog` на `toTimerTask` обязан сохранить семантику `||`, а не заменить её на `??`: сегодня нулевое значение схлопывается в дефолт, и менять это молча нельзя. Существующие тесты эти пути не покрывают (грепом по `tests/` — ни одного упоминания `startTask`), поэтому регрессию ловим новым юнит-тестом на `toTimerTask`.

TDD: yes (`getActiveTasksAt` и `toTimerTask` — чистые функции с содержательными краями: границы окна, all-day, отсутствие длительности, выполненные, `isOverdue`, нулевые настройки помидоро).

### Invariants

- `getActiveTasksAt` и `toTimerTask` — чистые функции без импортов Vue, Pinia и обращений к `Date.now()` внутри: момент времени передаётся аргументом.
- Виджет читает исключительно `taskStore.tasks`. `tasksToCalendarEvents` не используется, id с `__virtual__` в виджет не попадают ни при каких данных.
- Задача попадает в виджет только при `start <= now < end`; граница `end` исключающая, чтобы смежные задачи не показывались одновременно.
- Из выборки исключены: без `dueDate`, all-day (время ровно `00:00`), `completed`, `isOverdue`.
- Кнопка запуска рендерится только при `isPomodoroTask`.
- Пустой список — в DOM нет ни заголовка, ни контейнера виджета.
- Во всём фронтенде ровно один маппинг задачи в аргумент `startTask` — `toTimerTask`.
- `toTimerTask` сохраняет `||`-семантику дефолтов, существовавшую в обоих исходных местах.
- Виджет доступен и в десктопном, и в мобильном сайдбаре.
- `features/calendar/**` не изменяется. Бэкенд не изменяется.

### Principles

- Виджет — пассивный читатель стора: собственных сетевых запросов не делает и данные не мутирует.
- Переиспользовать существующее (`computeTaskDurationMinutes`, `POMODORO_DEFAULTS`, `startTask`, стиль заголовка «ПРОЕКТЫ»), а не заводить параллельное.
- Время — аргумент, а не глобальное состояние: всё, что зависит от «сейчас», получает его снаружи и потому тестируемо без подмены часов.
- YAGNI: ни клика по строке, ни пустого состояния, ни настроек виджета.

## Plan

Approach: две чистые функции пишутся TDD-first и покрывают всю логику; компоненты остаются тонкими и бездумными, а подключение к сайдбару сводится к смене одного значения в реестре `AppLayout`.

### Phase 1 — Чистые функции: окно активности и маппинг в таймер

- **1.1** `alfy-bot-frontend/tests/features/tasks/lib/active-tasks.spec.ts` (create) — **красный первым**
- **1.2** `alfy-bot-frontend/src/features/tasks/lib/active-tasks.ts` (create)
  - `export function getActiveTasksAt(tasks: Task[], now: Date): Task[]`
  - Отбор: есть `dueDate`; не `completed`; не `isOverdue`; не all-day (`dueDate.getHours() !== 0 || dueDate.getMinutes() !== 0` — зеркалит `calendar-events.ts:13`); `start <= now < start + computeTaskDurationMinutes(task) * 60_000`.
  - Сортировка по возрастанию `dueDate`.
  - Переиспользует `computeTaskDurationMinutes` из `../lib/duration`.
  - Invariant: чистая функция без Vue/Pinia и без `Date.now()` внутри; граница `end` исключающая; исключения из выборки.
- **1.3** `alfy-bot-frontend/tests/features/task-timer/to-timer-task.spec.ts` (create) — **красный первым**
- **1.4** `alfy-bot-frontend/src/features/task-timer/lib/to-timer-task.ts` (create)
  - `export function toTimerTask(task: Task): TimerTask` — `Task` из `@/features/tasks/model/types`, `TimerTask` — интерфейс `Task` из `../types`.
  - Дефолты через `POMODORO_DEFAULTS` (`@/features/tasks/model/constants`), оператор **`||`**, не `??` — ровно как в обоих оригиналах.
  - Invariant: единственный маппинг в аргумент `startTask`; `||`-семантика сохранена.
- **1.5** `alfy-bot-frontend/src/features/task-timer/lib/index.ts` (create) — `export * from './to-timer-task'`; `alfy-bot-frontend/src/features/task-timer/index.ts` (modify) — добавить `export * from './lib'` третьей строкой к существующим `./ui` и `./model`. Потребители тянут `toTimerTask` из барреля фичи, как сейчас тянут `useTimerStore` и `TimeBlock`.
- Commit: `feat(tasks): add active-task window and timer-task mapping helpers`

### Phase 2 — Перевод существующих вызовов на toTimerTask

- **2.1** `alfy-bot-frontend/src/views/TasksView.vue:113-126` (modify) — `handleShowTimer`
  - Тело `startTask({...})` заменяется на `startTask(toTimerTask(task))`; guard `if (!task?.isPomodoroTask) return` остаётся.
- **2.2** `alfy-bot-frontend/src/features/tasks/ui/TaskDetailDialog.vue:677-687` (modify) — `handleStartTimer`
  - То же; guard `if (!props.task?.isPomodoroTask) return` остаётся.
- Invariant: во фронтенде остаётся ровно один маппинг; поведение бит-в-бит прежнее.
- Commit: `refactor(tasks): route timer start through toTimerTask`

### Phase 3 — Виджет и подключение к сайдбару

- **3.1** `alfy-bot-frontend/src/composables/useNow.ts` (create)
  - `export function useNow(intervalMs = 60_000): Ref<Date>` — `setInterval` в `onMounted`, `clearInterval` в `onUnmounted`.
- **3.2** `alfy-bot-frontend/src/features/tasks/ui/CurrentTaskWidget.vue` (create)
  - Читает `useTaskStore().tasks` через `storeToRefs`; `activeTasks = computed(() => getActiveTasksAt(tasks.value, now.value))`.
  - `v-if="activeTasks.length"` на корне — при пустом списке в DOM нет ничего.
  - Заголовок «Текущая задача» — обёртка `px-4 mt-4`, заголовок `text-[11px] font-medium text-sidebar-foreground/60 uppercase tracking-wide` (скопировано с `ProjectTreeNav.vue`).
  - Строка задачи: название + `<Button v-if="task.isPomodoroTask">` с иконкой `Play` из `lucide-vue-next`; `@click="timerStore.startTask(toTimerTask(task))"`.
  - Invariant: только `taskStore.tasks`, без `tasksToCalendarEvents`; кнопка только у `isPomodoroTask`; пустой список ничего не рендерит.
- **3.3** `alfy-bot-frontend/src/components/TasksSidebarSection.vue` (create)
  - Шаблон: `<CurrentTaskWidget />` затем `<ProjectTreeNav />`, оба импортированы статически.
- **3.4** `alfy-bot-frontend/src/components/AppLayout.vue:11-13,24-26` (modify)
  - `defineAsyncComponent` переезжает с `ProjectTreeNav.vue` на `TasksSidebarSection.vue`; переменная переименовывается в `TasksSidebarSection`; в реестре `tasks: TasksSidebarSection`.
  - Тип `Record<string, Component>` и шаблон (`AppLayout.vue:56-58`) не меняются.
  - Invariant: виджет доступен в обоих слотах `section-extra`, включая мобильный, — следствие того, что обёртка одна на оба.
- **3.5** `alfy-bot-frontend/tests/features/tasks/ui/CurrentTaskWidget.spec.ts` (create)
- Commit: `feat(tasks): current-task widget in the tasks sidebar`

### Test strategy

TDD: 1.1 до 1.2, 1.3 до 1.4. Тест виджета (3.5) пишется вместе с фазой.

`active-tasks.spec.ts` — время фиксируется явным `new Date(...)`, часы не подменяются:
- `now` ровно на `start` → активна (граница включающая)
- `now` за минуту до конца → активна
- `now` ровно на `end` → **не** активна (граница исключающая; две смежные задачи не показываются вдвоём)
- `now` до начала → не активна
- задача без `dueDate` → не активна
- all-day (`dueDate` в `00:00`) → не активна
- `completed: true` внутри окна → не активна
- `isOverdue: true` внутри окна → не активна
- помидоро-задача: окно = `count*duration + перерывы` (проверка на 2×25+5=55 мин, как «Гитара» со скриншота)
- не-помидоро без `durationMinutes` → окно 60 минут (дефолт `computeTaskDurationMinutes`)
- две пересекающиеся активные задачи → обе в результате, отсортированы по `dueDate`

`to-timer-task.spec.ts`:
- полностью заполненная задача → все поля перенесены один в один
- пустая задача → все дефолты из `POMODORO_DEFAULTS`
- `pomodoroDuration: 0` → **25**, а не 0 (фиксирует `||`-семантику; именно этот тест ловит подмену на `??`)
- `id` переносится без изменений

`CurrentTaskWidget.spec.ts` (по образцу `TaskCardBadges.spec.ts`, стор через `setActivePinia`):
- нет активных задач → компонент не рендерит ни заголовка, ни контейнера
- одна активная помидоро-задача → видно название и кнопку
- активная не-помидоро задача → название есть, кнопки нет
- клик по кнопке зовёт `timerStore.startTask` с `id` этой задачи
- две активные → две строки

### Order & dependencies

Phase 1 → Phase 2 (2.x импортируют `toTimerTask`) → Phase 3 (3.2 импортирует обе функции). Внутри Phase 3: 3.1 и 3.2 до 3.3, 3.3 до 3.4.

### Backwards compatibility

- Phase 3.4 меняет значение `sectionExtraRegistry.tasks`. Потребитель один — шаблон `AppLayout.vue:56-58`. `tests/components/AppLayout.spec.ts` мокает `AppSidebar` целиком и гоняет только роуты `habits`, слот `section-extra` не затрагивает — регрессии там не будет, но прогон всё равно обязателен.
- Phase 2 обязана сохранить `||`. Регрессию ловит тест из 1.3 (`pomodoroDuration: 0 → 25`), написанный **до** перевода вызовов.
- Ленивая загрузка: `defineAsyncComponent` не исчезает, а переезжает на обёртку — количество чанков сайдбара не растёт.

### Open questions / risks / rollback

- `useNow` создаёт интервал на каждый экземпляр. Виджет монтируется дважды (десктопный `<aside>` и мобильная панель существуют в DOM одновременно, скрыты через CSS/`v-show`) — получится два интервала по 60 секунд. Это дёшево и корректно, но если понадобится один общий тик — выносить `useNow` в модульный синглтон. Не делать превентивно.
- Rollback: три независимых коммита. Откат Phase 3 убирает виджет, оставляя вынесенные функции; откат Phase 2 возвращает инлайновые маппинги.

## Verify
<empty — filled by up:uverify>

## Conclusion
<empty — filled by up:ureview>
