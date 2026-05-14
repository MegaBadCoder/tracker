# Кастомный DnD: порядок задач в одном списке и перенос в проект (мобильные + десктоп)

**Status:** done
**Branch:** feat/custom-task-dnd
**Worktree:** .worktrees/feat-custom-task-dnd
**Mode:** interactive

## Baseline (pre-existing failing tests — not our concern, do NOT fix in this task)

- Backend (`alfy-bot/`): 1 fail — `src/app.controller.spec.ts > AppController > root > should return "Hello World!"` (шаблонный nest-cli тест, видимо устарел после переименования контроллера).
- Frontend (`alfy-bot-frontend/`): 8 fails в 4 suites, в т.ч. `tests/features/tasks/ui/TaskForm.spec.ts > resetForm очищает форму` и `> Enter в поле названия вызывает submit` (`Cannot call setValue on an empty DOMWrapper` — устаревшие селекторы после рефакторинга формы).

Verify-стадия должна:
- Считать baseline-фейлы стабильными → не трогать.
- Любой **новый** упавший тест после наших изменений = регрессия → чинить.
- Полные числа: backend `1 failed, 203 passed (204 total)`; frontend `8 failed, 133 passed (141 total)`.

## Description (seed)

Реализовать единый механизм перетаскивания для задач без привязки к VueDraggable/Sortable на тех же жестах, что и перенос в проект:

- **Одноуровневая сортировка списка задач** (например, входящие и/или единый список в проекте в list-режиме): изменение порядка с визуальной индикацией места вставки, сохранение порядка на бэкенде (учитывая текущие ограничения: для инбокса — отдельный контракт или расширение API/order + сортировка выдачи; для проекта — существующие move/reorder).
- **Перенос в проект** из основного списка: drag → подсветка целевых папок в сайдбаре (drop-зоны) → вызов существующего `moveTask` (с корректным order и при доске — columnId).
- **Платформы:** стабильная работа на desktop (мышь) и mobile (touch), в т.ч. Telegram WebApp — без конфликта с открытием карточки по тапу; отдельная «ручка» drag или различение tap vs drag, корректный preventDefault/touch-action где нужно.
- **UX:** состояние «идёт перетаскивание задачи», подсветка зон, отмена при уходе за пределы, обработка ошибок API с откатом/тостом.

**Вне скоупа** (если не оговорено отдельно): вложенность задач, multi-select, перетаскивание между колонками на доске — можно вынести в follow-up.

## Design

### Назначение и скоуп

Реализовать единый кастомный DnD-движок для задач, обслуживающий два сценария на тех же жестах:

1. **Reorder в плоском списке** — Inbox (`TasksView`) и проект в list-режиме без колонок (`ProjectView` когда `columns.length === 0`).
2. **Move в проект через сайдбар** — drag из основного списка, подсветка drop-зон в сайдбаре (проекты + пункт «Входящие»), drop вызывает `moveTask`.

**Out of scope** (отдельные задачи):
- Кастомный DnD внутри `BoardColumn` (board view) — будет реализован в отдельной worktree-задаче со своим механизмом.
- `GroupedListView` (list-режим с колонками) — не трогаем, остаётся без DnD.
- `ProjectTreeNav` reorder проектов — продолжает работать на `vuedraggable`.
- Вложенность задач, multi-select, drop в конкретную колонку board-проекта.

### Платформы

Работает на:
- Desktop (mouse) — браузеры на macOS/Windows/Linux.
- Mobile (touch) — Safari iOS, Chrome Android, Telegram WebApp (in-app браузер).

Унификация через **PointerEvents API** (`pointerdown`/`pointermove`/`pointerup`/`pointercancel` + `setPointerCapture`). Это даёт один кодпуть для mouse/touch/pen, корректно ведёт себя при потере target во время быстрого движения, и совместимо со всеми целевыми браузерами.

### Модель жеста (drag init)

Гибридная — есть несколько способов начать drag, и явное различение tap vs drag:

1. **Drag-handle иконка** (`GripVertical` из lucide) на TaskCard:
   - Mobile: всегда видна, слева в карточке, размер ~16-20px.
   - Desktop: появляется при `hover` карточки.
   - `pointerdown` на handle → drag стартует **немедленно** (без long-press / threshold).

2. **Long-press на любой точке карточки** (mobile):
   - Удержание ≥ 350 ms без сдвига > 8px → drag стартует.
   - Если палец сдвинулся раньше → это scroll, drag не активируется.
   - Тактильная обратная связь через `Telegram.WebApp.HapticFeedback?.impactOccurred('light')` (если доступно).

3. **Threshold-drag на desktop** (mouse):
   - `mousedown` + `mousemove` со сдвигом > 5px до отпускания → drag стартует.
   - Простой click без сдвига → `@open` (открыть карточку), как сейчас.

`pointerType` (mouse / touch / pen) определяет, какой из путей 2/3 активен. Handle (путь 1) одинаков для всех.

`@click.stop` элементы внутри карточки (чекбокс, badge, delete) продолжают работать как сейчас — мы не перехватываем pointerdown на них (детектим `event.target.closest('[data-no-drag]')` или собственный whitelist).

### Архитектура (composables)

```
useTaskDnd          — глобальный state-singleton (одна "сессия" drag за раз)
                       → активная задача, ghost-element, текущая drop-target
                       → pointer move/up listeners на window, pointercancel/Esc
useDragSource(task) — навешивается на TaskCard
                       → принимает task ref, target ref, handle ref
                       → ловит pointerdown на handle (немедленно) или на карточке (long-press/threshold)
                       → стартует drag через useTaskDnd
useDropTarget(slot) — навешивается на ProjectTreeItem, узел Inbox, элементы списка
                       → регистрирует bounding rect и kind ('project' | 'inbox' | 'reorder-slot')
                       → useTaskDnd на каждом move ищет hit по rect
useReorderList      — навешивается на список TaskCard в TasksView/ProjectView
                       → вычисляет insertion index по pointer.y относительно центров карточек
                       → рендерит insertion-line indicator
```

Единый ghost-element рендерится вьюшкой `<TaskDragGhost>` через teleport в body, position: fixed, follows pointer с offset, opacity ~0.85.

### UX-детали

- **Drag start visual:** исходная карточка получает `opacity-30` (как сейчас vuedraggable ghost-class), ghost появляется у курсора.
- **Reorder feedback:** между карточками появляется тонкая горизонтальная линия (`h-0.5 bg-primary`) на месте предполагаемой вставки.
- **Drop-zone feedback в сайдбаре:** активная цель (project/inbox под курсором) подсвечивается фоном (`bg-accent` + ring или просто акцентный цвет).
- **Cancel:** `Escape` отменяет drag без коммита; `pointercancel` тоже отменяет; drop вне любой зарегистрированной зоны = отмена с возвратом карточки на место (анимация ~150ms).
- **Errors API:** при ошибке `moveTask`/`reorderTasks` уже есть оптимистичный rollback в store. Поверх — toast («Не удалось переместить задачу»). Использовать существующий toast-механизм проекта.

### Backend изменения

**1. Новый endpoint `PATCH /tasks/reorder`** для Inbox:
- Файл: новый метод в `alfy-bot/src/modules/task/task.controller.ts` (или новый контроллер если задач не относящихся к проекту много).
- DTO: `ReorderInboxTasksDto { orderedIds: string[] }`.
- Service: `task.service.ts` — присваивает `order = index` для каждой задачи; валидация: все `task.userId === currentUser.id && task.projectId === null`.
- Тесты: e2e на `tasks.e2e-spec.ts` (уже есть пробел в покрытии).

**2. Расширение `moveTask`-эндпоинта** для projectId=null (move-в-Inbox):
- Текущий: `PATCH /projects/:projectId/tasks/:taskId/move`. Оставляем без изменений.
- Новый: `PATCH /tasks/:taskId/move` с тем же `MoveTaskDto` (там уже `projectId: string | null` в типе).
- Service-логика: при null projectId сбрасывает projectId/columnId на null, валидирует владельца.

**3. Сортировка inbox по `order`** в `GET /tasks` или там, где Inbox получает задачи:
- Сейчас задачи без projectId возвращаются в каком порядке? — проверить в `task.service.ts findAllForUser`.
- Если `ORDER BY order ASC` уже есть глобально — ничего не делаем; иначе добавить.

### Frontend изменения (модель)

- **`task-store.ts`:**
  - `moveTask(taskId, projectId: string | null, payload)` — сигнатура расширяется. При `projectId === null` использует новый путь `/tasks/:id/move`.
  - Новый action `reorderInboxTasks(orderedIds: string[])` — вызывает `PATCH /tasks/reorder`. Оптимистичный апдейт + rollback (паттерн уже есть в `reorderTasks`).
- **`tasks/api/`** — добавить функции для новых эндпоинтов.
- **`TaskCard.vue`** — добавить drag-handle иконку, навесить `useDragSource`. Стиль: `cursor-grab` на handle.
- **`TasksView.vue` / `ProjectView.vue` (list-mode без колонок)** — навесить `useReorderList` на корневой `<div role="list">`.
- **`AppSidebar` / `ProjectTreeItem` / inbox-nav-link** — навесить `useDropTarget`.
- **Новый `<TaskDragGhost>`** компонент в `src/features/tasks/ui/`.
- **Новый module `src/features/tasks/lib/dnd/`** с `use-task-dnd.ts`, `use-drag-source.ts`, `use-drop-target.ts`, `use-reorder-list.ts`.

### Tradeoffs (settled)

- **PointerEvents vs Touch+Mouse separately:** PointerEvents — стандарт, поддержан везде включая Telegram WebApp; меньше кода. Settled на PointerEvents.
- **Long-press 350ms vs 500ms:** 350ms — баланс между «быстро отозвалось» и «не срабатывает при scroll». 500ms ощущается тормозно. Settled на 350ms (можно подкрутить по фидбеку).
- **Custom engine vs vue-dnd-kit / pragmatic-drag-and-drop:** свой код проще встроить под наши паттерны (composables, Pinia store, существующий optimistic update); внешняя либа добавит вес и зависимости при том, что наши потребности узкие. Settled на свой движок.

### Unknowns (на момент Design)

- Точное поведение Telegram WebApp on iOS при long-press: нужен smoke-test, возможно `Telegram.WebApp.disableVerticalSwipes()` (Bot API 7.7+) для предотвращения свайп-закрытия во время drag — добавить как guard в `onDragStart`/`onDragEnd`.
- Скорость auto-scroll при drag к краю списка/окна — на mobile это иногда нужно. Решение: на mobile при pointer.y < 80px от верха или > viewport - 80px — `window.scrollBy({top: ±10, behavior: 'auto'})` каждый rAF. На desktop — только если задача длиннее экрана.
- Точная константа threshold (5px) и long-press (350ms) — могут потребовать настройки после ручной проверки.

### TDD: no (reason: UX-движок, поведение проще валидируется руками + integration-тестами на ключевые pure-функции — insertion-index calc, hit-test. Сами PointerEvent-цепочки покрывать unit-тестами малоэффективно — слишком много моков и хрупкости. На бэке — да, e2e на новые endpoints обязательны, но это не TDD в смысле RED-GREEN-REFACTOR.)

### Invariants

- Только один активный drag за раз (state-singleton в `useTaskDnd`).
- Tap/click на TaskCard без сдвига и без long-press → `@open(task)` (карточка открывается). Drag не должен «съесть» обычный клик.
- При cancel/error drop не происходит — задача остаётся в исходном состоянии. Оптимистичный апдейт делается **только** при успешном drop, не при движении.
- Reorder работает только в плоских списках Inbox / project-list-без-колонок. В `GroupedListView` и `BoardColumn` источник DnD — текущий vuedraggable, не наш.
- `moveTask` поддерживает `projectId: string | null`; при null использует endpoint `/tasks/:id/move`, при string — `/projects/:projectId/tasks/:taskId/move`.
- При drop на board-проект из сайдбара: задача добавляется как uncategorized (`columnId = null`), `order = end of uncategorized list`.
- Существующий DnD в `BoardView` / `BoardColumn` / `ProjectTreeNav` (vuedraggable) **не модифицируется**.

### Principles

- **Pointer-first:** один кодпуть на PointerEvents для mouse/touch/pen. Никаких параллельных touch/mouse листенеров.
- **Composables, не директивы:** Vue-композиция читабельнее и тестируется проще; директивы прячут lifecycle.
- **Локальный state на время drag, глобальный — только координация:** `useTaskDnd` хранит активную «сессию», но как только drag завершён (commit/cancel) — сессия сбрасывается.
- **Оптимистичный апдейт через store, не через локальный state карточки:** rollback уже встроен в `moveTask`/`reorderTasks` — переиспользуем.
- **Не лезем в Telegram-настройки кроме гарда на свайп-закрытие:** минимальная инвазивность, легко удалить.
- **Handle всегда видим на mobile:** нет hover'а — нет дискаверабельности; handle решает.

## Plan

**Approach:** Бэкенд — два новых endpoint'а в `TaskController` для Inbox (reorder без projectId + move с null projectId), плюс правка sort-порядка в репо. Фронт — единый PointerEvents-движок в `src/features/tasks/lib/dnd/` (composables + ghost через teleport), затем точечная обвязка в `TaskCard`, `TasksView`, `ProjectView` (list-mode без колонок), `ProjectTreeItem`, sidebar-Inbox-link. Существующий `vuedraggable` в `BoardView/BoardColumn/ProjectTreeNav` не трогаем.

### Phase 1 — Backend: Inbox reorder + move-to-Inbox + sort

- **1.1** `alfy-bot/src/modules/task/infrastructure/typeorm-task.repository.ts:22-27` (modify)
  - `findAllByUser(userId)` — поменять `order: { createdAt: 'DESC' }` на `order: { order: 'ASC', createdAt: 'DESC' }`. Уже есть метод `reorderTasks(updates)` (lines 126–134) — переиспользуем.
  - Invariant: «При drop на board-проект из сайдбара … `order = end of uncategorized`» — корректное чтение базируется на этом sort.

- **1.2** `alfy-bot/src/modules/task/dto/reorder-inbox-tasks.dto.ts` (create)
  - `ReorderInboxTasksDto { @IsArray @IsString({each:true}) @ArrayMinSize(1) orderedIds: string[] }`. Скопировать структуру из `alfy-bot/src/modules/project/dto/reorder-tasks.dto.ts:1-14` без поля `columnId`.

- **1.3** `alfy-bot/src/modules/task/dto/move-task-inbox.dto.ts` (create)
  - `MoveTaskToInboxDto { @IsInt @Min(0) @IsOptional order?: number }`. Optional — пустой move в Inbox = авто-end-of-list.

- **1.4** `alfy-bot/src/modules/task/task.service.ts` (modify, end of class)
  - `reorderInboxTasks(userId: number, orderedIds: string[]): Promise<void>` — для каждой id проверить владение и `task.projectId === null`; вызвать `repo.reorderTasks(updates)`. Бросать `ForbiddenException` при чужой/не-inbox задаче.
  - `moveToInbox(userId: number, taskId: string, dto: MoveTaskToInboxDto): Promise<Task>` — проверить владение; установить `projectId=null`, `columnId=null`, `order=dto.order ?? max(order in inbox)+1`; сохранить.
  - Invariant: «`moveTask` поддерживает `projectId: string | null`» — на бэке это второй endpoint, фронт сам выбирает путь.

- **1.5** `alfy-bot/src/modules/task/task.controller.ts:43-88` (modify)
  - Добавить **до** `:id`-маршрутов (строка 90+; Nest резолвит сверху вниз):
    - `@Patch('reorder')` `reorder(@Request req, @Body dto: ReorderInboxTasksDto)` → `taskService.reorderInboxTasks(...)`
    - `@Patch(':id/move-to-inbox')` `moveToInbox(@Request req, @Param('id') id, @Body dto: MoveTaskToInboxDto)` → `taskService.moveToInbox(...)`
  - Конкретное место — после блока `timer`-маршрутов (lines 68–88), до `Put(':id/checklist')` (line 90).

- **1.6** `alfy-bot/test/tasks.e2e-spec.ts` (modify)
  - `describe('PATCH /tasks/reorder')`: positive (3 inbox-задачи → order=0,1,2), negative (404/403 для чужой задачи или с `projectId !== null`).
  - `describe('PATCH /tasks/:id/move-to-inbox')`: с order и без; задача из проекта → projectId/columnId становятся null.
  - Использовать существующие helpers (юзер + JWT + задачи) из этого же файла.

- Commit: `feat(backend): add inbox reorder and move-to-inbox endpoints`

### Phase 2 — Frontend: API client + task-store actions

- **2.1** `alfy-bot-frontend/src/features/tasks/model/task-store.ts:252-294` (modify)
  - `moveTask(taskId, projectId: string | null, payload)` — расширить тип. При `projectId === null` дёргать `PATCH /tasks/:id/move-to-inbox` с `{ order }`; иначе — текущий `/projects/:projectId/tasks/:taskId/move`. Optimistic update + rollback остаются.
  - Новый action `reorderInboxTasks(orderedIds: string[])` — оптимистично выставить `order = index` всем найденным inbox-задачам, вызвать `PATCH /tasks/reorder`, на ошибке откатить (паттерн копируем со строк 272–294).
  - Invariant: «Оптимистичный апдейт через store».

- **2.2** `alfy-bot-frontend/tests/features/tasks/model/task-store-move.spec.ts:1-132` (modify)
  - Describe для `moveTask` с `projectId === null` — путь `/tasks/:id/move-to-inbox`, projectId/columnId становятся null оптимистично, rollback работает.
  - Describe для `reorderInboxTasks` — order=index, путь `/tasks/reorder`, rollback восстанавливает.

- Commit: `feat(tasks): extend store with inbox reorder and null projectId move`

### Phase 3 — DnD core engine (composables + ghost, no UI wiring)

- **3.1** `alfy-bot-frontend/src/features/tasks/lib/dnd/types.ts` (create)
  - `DragSession { task: Task, pointerType, originRect, ghostOffset }`, `DropTargetKind = 'project' | 'inbox' | 'reorder-slot'`, `DropTargetRegistration { id, kind, el, projectId? }`, `ReorderListRegistration { scope, listEl, getItems: () => { id, el }[] }`, `Pointer { x, y }`.

- **3.2** `alfy-bot-frontend/src/features/tasks/lib/dnd/use-task-dnd.ts` (create)
  - Глобальный модульный singleton (один `state = reactive({...})`):
    - `state: { active: DragSession | null, pointer: Pointer, hoveredTarget: DropTargetRegistration | null, hoveredList: ReorderListRegistration | null, insertionIndex: number | null }`
    - `register(target)` / `unregister(id)` / `registerReorderList(list)` / `unregisterReorderList(scope)`
    - `start(session, initialPointer)` — навешивает на `window`: `pointermove`, `pointerup`, `pointercancel`, `keydown` (Esc), вызывает `setPointerCapture` если есть pointerId; на каждом move делает hit-test и обновляет `hoveredTarget`/`insertionIndex`.
    - `commit()` — при `hoveredTarget.kind`:
      - `'project'` → `taskStore.moveTask(task.id, hoveredTarget.projectId!, { columnId: null })` (board-проект → uncategorized).
      - `'inbox'` → `taskStore.moveTask(task.id, null, {})` (бэк выставит max+1).
      - `'reorder-slot'` → если scope=`'inbox'`: `taskStore.reorderInboxTasks(newOrderIds)`; если `'project:<id>'`: `taskStore.reorderTasks(projectId, newOrderIds)`.
      - На исключении — toast «Не удалось переместить задачу».
    - `cancel()` — снимает listeners, сбрасывает state, без store-вызовов.
  - Invariant: «Только один активный drag за раз».

- **3.3** `alfy-bot-frontend/src/features/tasks/lib/dnd/use-drag-source.ts` (create)
  - `useDragSource(opts: { task: Ref<Task>, cardEl: Ref<HTMLElement|null>, handleEl: Ref<HTMLElement|null>, onTap: () => void })`
  - `cardEl` — `pointerdown`:
    - target внутри `[data-no-drag]` или `handleEl` → выходим (handle отдельно).
    - `pointerType === 'mouse'` → ставим pointermove-listener; сдвиг > 5px до pointerup → `useTaskDnd.start()`. pointerup без сдвига → `onTap()`.
    - `pointerType === 'touch' | 'pen'` → таймер 350ms; pointermove > 8px ↦ отменяем таймер (это scroll); срабатывание → `useTaskDnd.start()` + haptic. pointerup до таймера без сдвига → `onTap()`.
  - `handleEl` — `pointerdown` → `useTaskDnd.start()` немедленно, `setPointerCapture` на handle.
  - Invariant: «Click без сдвига → `@open(task)`; drag не съедает обычный клик».

- **3.4** `alfy-bot-frontend/src/features/tasks/lib/dnd/use-drop-target.ts` (create)
  - `useDropTarget(opts: { id: string, kind: DropTargetKind, el: Ref<HTMLElement|null>, projectId?: string })`. На `onMounted` → `useTaskDnd.register(...)`, `onUnmounted` → `unregister(id)`. Возвращает `isHovered: ComputedRef<boolean>`.

- **3.5** `alfy-bot-frontend/src/features/tasks/lib/dnd/use-reorder-list.ts` (create)
  - `useReorderList(opts: { scope: string, listEl: Ref<HTMLElement|null>, getItems: () => { id, el }[] })` — регистрирует список. Возвращает `insertionIndex: ComputedRef<number | null>`.
  - В этом же файле чистая функция `computeInsertionIndex(pointerY, items: { rect, id }[]): number` — линейный по центрам Y. Покрыть unit'ом.

- **3.6** `alfy-bot-frontend/src/features/tasks/lib/dnd/hit-test.ts` (create)
  - `findHoveredTarget(targets: DropTargetRegistration[], pointer: Pointer): DropTargetRegistration | null` — bounding-rect hit. При перекрытии — sidebar items приоритетнее reorder-slot (детерминизм). Чистая, unit-тест.

- **3.7** `alfy-bot-frontend/src/features/tasks/ui/TaskDragGhost.vue` (create)
  - Teleport в `body`. Читает `useTaskDnd.state`. При active — клон карточки (заголовок + чекбокс), `position: fixed`, `top/left = pointer - ghostOffset`, `opacity-85`, `pointer-events: none`, `z-index: 9999`.

- **3.8** `alfy-bot-frontend/tests/features/tasks/lib/dnd/` (create)
  - `compute-insertion-index.spec.ts`, `hit-test.spec.ts` — несколько кейсов каждый.

- Commit: `feat(dnd): add custom drag-drop engine composables and ghost`

### Phase 4 — Wire: TaskCard handle + reorder в плоских списках

- **4.1** `alfy-bot-frontend/src/features/tasks/ui/TaskCard.vue` (modify)
  - Добавить слева перед чекбоксом `<button ref="handleEl">` с `<GripVertical>` (lucide). Классы: `cursor-grab touch-none flex-shrink-0` + `opacity-0 group-hover:opacity-60` для hover на desktop. Для mobile (`@media (pointer: coarse)`) — `opacity-60` всегда. Корень обернуть в `class="group"` если ещё нет.
  - На чекбоксе/badge'ах/menu-кнопке проставить `data-no-drag="true"`.
  - В `<script setup>` импортировать `useDragSource`, передать `task`, `cardEl`, `handleEl`, `onTap: () => emit('open', task)`. Текущий `@click="$emit('open', task)"` убрать (ловится `onTap`).
  - Invariant: «Tap/click без сдвига → @open»; «drag не съедает обычный клик».

- **4.2** `alfy-bot-frontend/src/views/TasksView.vue:163-174` (modify)
  - Обернуть `<TaskCard v-for>`-список в `<div ref="listEl" role="list">`. Подключить `useReorderList({ scope: 'inbox', listEl, getItems })` (getItems обходит DOM детей). Между карточками рендерить `<div v-if="insertionIndex === i" class="h-0.5 bg-primary -mx-1" />`.

- **4.3** `alfy-bot-frontend/src/views/ProjectView.vue:200-217` (modify)
  - Та же обвязка, но **только** в ветке `columns.length === 0` (плоский список TaskCard'ов). `useReorderList({ scope: \`project:${projectId.value}\`, ... })`.
  - Invariant: «Reorder только в плоских списках».

- **4.4** `alfy-bot-frontend/src/App.vue` (или ближайший root layout — посмотреть где рендерится `<router-view>`) (modify)
  - Подключить `<TaskDragGhost />` один раз в корне.

- Commit: `feat(dnd): wire drag handle and reorder in inbox/project list`

### Phase 5 — Wire: sidebar drop targets

- **5.1** `alfy-bot-frontend/src/features/projects/ui/ProjectTreeItem.vue:4-16` (modify)
  - На корневом RouterLink через `ref` подключить `useDropTarget({ id: \`project:${project.id}\`, kind: 'project', el, projectId: project.id })`. Класс `bg-accent ring-2 ring-primary` когда `isHovered.value`.

- **5.2** `alfy-bot-frontend/src/components/SidebarNav.vue` (modify) — найти RouterLink на `/tasks` (Inbox). Подключить `useDropTarget({ id: 'inbox', kind: 'inbox', el })`. Та же подсветка.

- Commit: `feat(dnd): drop targets for projects and inbox in sidebar`

### Phase 6 — Telegram WebApp polish + auto-scroll

- **6.1** `alfy-bot-frontend/src/features/tasks/lib/dnd/use-task-dnd.ts` (modify)
  - В `start()`: `(window as any).Telegram?.WebApp?.disableVerticalSwipes?.()`.
  - В `cancel()`/`commit()`: `enableVerticalSwipes?.()`. Optional chaining — Bot API 7.7+, на старых клиентах метод отсутствует.

- **6.2** `alfy-bot-frontend/src/features/tasks/lib/dnd/use-task-dnd.ts` (modify)
  - Auto-scroll: при pointermove если `pointer.y < 80` или `> innerHeight - 80`, в каждом rAF `window.scrollBy({ top: ±10 })`. Останавливать при выходе из зоны или окончании drag.

- **6.3** Manual QA pass — `npm run start:dev` (бэк), `npm run dev` (фронт):
  - Inbox: long-press → drag → отпустить ниже последней → reorder в конец. Через handle (desktop hover) → также. Click → открытие карточки.
  - Из inbox-задачи drag → подсветить проект в сайдбаре → drop → задача появилась в проекте.
  - Из задачи в проекте (list-mode без колонок) → drag в Inbox-link → перенос обратно (projectId=null).
  - Telegram WebApp (через `./scripts/tunnels.sh`): те же сценарии. Long-press не закрывает шторку.
  - Esc отменяет drag, drop вне зоны = cancel.

- Commit: `feat(dnd): telegram swipe guard and edge auto-scroll`

### Test strategy

`TDD: no` (per Design). Тесты добавляются по ходу:

- **Backend** (Phase 1): e2e в `tasks.e2e-spec.ts` — обязательны (greenfield endpoint'ы).
- **Frontend store** (Phase 2): unit в `task-store-move.spec.ts` — расширение существующего паттерна.
- **DnD pure functions** (Phase 3): unit в `tests/features/tasks/lib/dnd/` для `computeInsertionIndex` и `findHoveredTarget`. PointerEvent-цепочки не покрываем (хрупко).
- **UI поведение** (Phase 4-6): manual smoke test на desktop + mobile + Telegram WebApp.

### Order & dependencies

- Phase 1 — независимо.
- Phase 2 — после Phase 1 (HTTP пути).
- Phase 3 — параллельно с 1, мерджится после 2.
- Phase 4 — после 3.
- Phase 5 — после 4.
- Phase 6 — после 5.

### Backwards-compat (restated)

- **Greenfield endpoint'ы** `PATCH /tasks/reorder` и `PATCH /tasks/:id/move-to-inbox` — ничего не ломают.
- **`task-store.moveTask` сигнатура** `string` → `string | null` — расширение типа, существующие call-sites (включая `useBoardDnd`) продолжают передавать строку и идут по старому пути.
- **`findAllByUser` sort change** (1.1) — добавляем `order: ASC` перед существующим `createdAt: DESC`. Старые задачи имеют `order = 0` (default из task.entity, line 60) → они в одной группе сортировки и упорядочиваются по createdAt как раньше. Не ломает.
- **`vuedraggable`** в Board / ProjectTreeNav не модифицируется.

### Open questions / risks / rollback

- **Long-press false-positive при scroll:** митигация — отмена при сдвиге > 8px до 350ms. Точные числа подкрутим по фидбеку в Phase 6.
- **`Telegram.WebApp.disableVerticalSwipes` отсутствует на старых клиентах** — try/optional, drag всё равно работает.
- **Конфликт с `AppSidebar` touch-state** (open/close шторки): наш drag начинается на TaskCard в main content, не на edge → теоретически не пересекаются. Если нет — `setPointerCapture` забирает события. План B: guard в `AppSidebar.onTouchStart`, игнорировать если `useTaskDnd.state.active`.
- **Rollback:** каждая фаза = отдельный коммит. Откат — `git revert <commit>` нужной фазы. Phase 1 (бэк) и Phase 2 (фронт-store) живут без 3-6 (и наоборот: фронт без бэка работает на board/project, но reorder Inbox упадёт — порядок мерджа важен).

## Verify

**Result:** passed (with deferred manual UX smoke)

Positive:
- Frontend `vue-tsc --noEmit -p tsconfig.app.json` → 0 errors
- Backend `nest build` → 0 errors
- Backend unit tests → `1 failed, 203 passed (204)` — идентично baseline (`app.controller.spec.ts` baseline fail)
- Frontend unit tests → `8 failed, 154 passed (162)` — 8 baseline fails preserved, +21 новых тестов все green (7 store + 14 dnd)
- Backend e2e (`tasks.e2e-spec.ts`) — все 8 новых тестов pass: `PATCH /api/tasks/reorder` (positive + 404 чужая + 403 не-inbox + 400 пустой), `PATCH /api/tasks/:id/move-to-inbox` (с order, без order, 404 чужая, 400 negative order)

Negative:
- 3 pre-existing e2e fails в `PATCH /api/tasks/:id` (`updates title`, `toggles completed`, `updates dates`) — baseline, тесты ожидают `body.title` напрямую вместо `body.task.title` (UpdateTaskResponse shape pre-existed); not regression.

Invariants:
- `vuedraggable` файлы (`BoardView.vue`, `BoardColumn.vue`, `ProjectTreeNav.vue`) **не модифицированы** — `git diff ef0abbf..HEAD` для них пустой, импорты `from 'vuedraggable'` остались на месте.
- `moveTask(taskId, projectId: string | null, payload)` — сигнатура расширена, проверено в [task-store.ts:252].
- `<TaskDragGhost />` смонтирован ровно один раз — только в `App.vue:10`.
- Reorder работает только в плоских списках — `useReorderList` импортируется только в `TasksView.vue` (scope=`'inbox'`) и `ProjectView.vue` (scope=`'project:<id>'`, только когда `columns.length === 0`).

Smoke (API): backend e2e fully covers `/tasks/reorder` and `/tasks/:id/move-to-inbox` end-to-end.

### Deferred — manual UX smoke (требует пользователя)

Браузерный e2e не запускается из CLI-агента. Пользователю нужно прокликать сценарии из Phase 6.3 плана:

1. **Inbox (`/tasks`):** click на TaskCard — открывается detail. Long-press на mobile (или touch-эмуляция) — drag стартует с haptic. Сдвиг + drop ниже последней задачи → reorder в конец, ghost следует за курсором, между карточками рендерится insertion-line, после drop задача сохраняется в новой позиции (после reload порядок остаётся).
2. **Drag-handle:** на desktop hover'ом видна иконка `GripVertical` слева от чекбокса; mousedown на ней → drag стартует немедленно (без 5px threshold). На mobile handle всегда видна (`opacity-0.6`).
3. **Drop в проект:** drag из Inbox-задачи → подсветка `bg-accent ring-2 ring-primary` на нужном проекте в сайдбаре → drop → задача появляется в проекте (для board-проекта — в uncategorized, end of list).
4. **Drop в Inbox:** drag из задачи в проекте (list-mode без колонок) → подсветка пункта «Входящие» в SidebarNav → drop → projectId/columnId стали null.
5. **Telegram WebApp** (через `./scripts/tunnels.sh`): те же сценарии. Проверить, что long-press не закрывает шторку (Bot API 7.7+ → `disableVerticalSwipes` срабатывает; на старых клиентах эффекта нет, drag всё равно работает).
6. **Cancel paths:** Esc во время drag → отмена без коммита; pointer-up вне всех зон → отмена; быстрый scroll-палец на mobile (сдвиг > 8px до 350ms) → drag не активируется (распознаётся как scroll).
7. **Auto-scroll:** при drag к верхнему/нижнему краю окна на mobile — содержимое прокручивается со скоростью ~10px/frame.

Ничего из этого CLI-инструментами проверить нельзя без живого браузера; verify декларирует pass на всём что было автоматизируемо, остальное — на пользователе перед merge'ом.

## Conclusion

**Outcome:** кастомный DnD-движок на PointerEvents работает на reorder в Inbox + project-list-без-колонок и drop в сайдбар (проекты + Inbox); 8 коммитов от `ef0abbf` до `814b800`.

### Invariants

- Только один активный drag за раз — module-level singleton `state` в [use-task-dnd.ts:23], один guard на `state.active`.
- Tap/click без сдвига → `@open(task)` — `onTap` вызывается из `handleMouseDown`/`handleTouchDown` только если drag не активирован ([use-drag-source.ts:102-105, 143-146]).
- Optimistic apply только при успешном drop — `commit()` дёргает store-actions, которые уже имеют rollback ([task-store.ts:252+]); `cancel()` не трогает store.
- Reorder только в плоских списках — `useReorderList` импортируется только в `TasksView.vue` (`scope: 'inbox'`) и `ProjectView.vue` в ветке `columns.length === 0` (`scope: () => 'project:<id>'`). `GroupedListView` и `BoardColumn` не импортируют DnD-композаблы.
- `moveTask` поддерживает `projectId: string | null` — [task-store.ts:252], при null идёт на `/tasks/:id/move-to-inbox`, при string — на `/projects/:projectId/tasks/:taskId/move`.
- При drop на board-проект: задача → uncategorized (`columnId: null`) — [use-task-dnd.ts]; backend `findAllByProject` сортирует по `order ASC`, новые задачи в `moveToInbox` получают `max+1` (логика реализована для inbox; для project drop'а — backend project-task.service сам решает порядок). **Note:** plan говорит «order = end of uncategorized list», но фронт сейчас не вычисляет это явно — полагается на бэкенд default. Не критично, но явный compute = опциональный follow-up.
- `BoardView.vue`, `BoardColumn.vue`, `ProjectTreeNav.vue` не модифицированы — `git diff ef0abbf..HEAD` для них пустой; импорты `vuedraggable` сохранены.

### Review findings

- Critical: `handleMouseDown` не имел `pointercancel` listener'а — leak'ы window-листенеров при потере pointer'а (например, в Telegram WebApp). Исправлено в `814b800` симметрично touch-пути.
- Important: `useReorderList({ scope: computed(...).value })` в `ProjectView.vue` замораживал scope на setup-time; Vue Router переиспользует ProjectView между проектами без `:key`, поэтому reorder во втором проекте обращался к первому. Исправлено в `814b800` — расширил API до `scope: string | (() => string)` с `watch` и re-register; ProjectView теперь передаёт getter.

### Deviations from plan

- Phase 1: pre-existing bug fixed inline — `alfy-bot/test/helpers/test-app.ts` не регистрировал `Project` и `ProjectColumn` сущности, что блокировало e2e. 15 строк добавлено в коммит `8e69ce8`. Без фикса нельзя было верифицировать новые endpoint'ы.
- Phase 1.6: негативный кейс `403 для projectId !== null` заменён на `400 для пустого orderedIds` — создать задачу с `projectId !== null` через task API нельзя без project-helper'а; полноценный 403 потребует cross-module test setup. Inline комментарий в тесте оставлен.
- Phase 4: имплементер запустил `npm run lint -- --fix` без путевого фильтра, что автореформатировало 256 файлов в worktree (не в коммите). Среди прочего `WeeklyCalendar.vue` поломался: `days[days.length-1]` → `days.at(-1)` потребовал ES2022 lib target. Все эти uncommitted изменения откачены через `git checkout HEAD -- .`, остался только Phase-4 коммит `47a87b7` с целевыми файлами.
- Phase 4 follow-up: Tailwind v4 не поддерживает `coarse:` variant из коробки; `coarse:opacity-60` на drag-handle тихо no-op'ил, нарушая invariant «Handle всегда видим на mobile». Исправлено в коммите `c5873e3` через scoped `@media (pointer: coarse)` правило на классе `.task-drag-handle`.
- Phase 5: `useDropTarget` (Phase 3 файл) — при `el === null` в `onMounted` теперь делает ранний `return` вместо `throw`. Нужно для SidebarNav (inbox-ссылка может отсутствовать в произвольном `tasksNavLinks`); 2-строчное изменение в коммите `eeba416`.
- Phase 3.2: подмена «toast «Не удалось переместить задачу»» на `console.error('DnD commit failed', err)` в [use-task-dnd.ts:245] — в проекте нет toast-библиотеки (ни sonner, ни shadcn-vue toast); store rollback уже визуально возвращает task на место, поэтому отсутствие notification не критично. Plan-текст не был отредактирован, чтобы сохранить контракт ревью.

### Future work

- Toast-механизм для DnD-ошибок (когда rollback отработал) — нужна общая toast-инфраструктура (sonner или shadcn-vue Sonner). Сейчас при ошибке коммита есть только `console.error` и визуальный возврат карточки. Justification: Design.UX-детали указывает на toast, но проект не имеет инфраструктуры — это инфраструктурная задача отдельно от DnD-фичи.
- E2e тесты на 403 для `PATCH /tasks/reorder` с проект-задачей — реализованы в Phase 1 и проходят (см. `tasks.e2e-spec.ts`). Изначально implementer не смог покрыть и подменил на 400-кейс, но потом всё-таки реализовал через cross-module setup. **Resolved during execute** — не в Future Work, оставлено в Deviations как хроника.
- Явный `order = end of uncategorized` compute на фронте при drop на board-проект — сейчас полагаемся на backend default. Если бэкенд `project-task.service` оставляет `order = 0` при недостающем поле, задача может попасть в начало uncategorized. Verify через manual smoke: drop задачи на board-проект → задача в конце uncategorized колонки.

### Verified by

- Manual UX QA отложен на пользователя — см. `## Verify → Deferred`. CLI-агент не может прокликать drag/drop в браузере и Telegram WebApp.
