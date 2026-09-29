# Спринты в agile-проекте

**Status:** executing
**Branch:** feat/agile-board
**Worktree:** .worktrees/feat-agile-board
**Mode:** interactive

## Design

### Зачем

Спринт отвечает на вопрос «что я делаю сейчас». Доска перестаёт быть свалкой всех задач проекта (как стало в Trello) и показывает только то, что взято в текущий спринт. Остальное ждёт в бэклоге, откуда задачи сознательно берутся в следующий спринт.

Это этап 3 Jira-подобного agile. До него сделаны тип проекта ([agile-project-type.md](agile-project-type.md)) и эпики с историями ([agile-epics-stories-ui.md](agile-epics-stories-ui.md)). Релизы (`Task.releaseId`) идут следующими. Ключи задач с префиксом проекта — отдельная задача потом.

### Решение 1 — сущность `Sprint`, связь через `Task.sprintId`

Таблица `sprints` в project-модуле, по образцу `BoardGroup`: `userId`, `projectId`, `name`, `goal`, `startDate`, `endDate` (дата без времени, `YYYY-MM-DD`), `status: 'planned' | 'active' | 'closed'`, `completedAt`, `order`.

Связь с задачей — одно поле `Task.sprintId` (nullable, `SET NULL` при удалении спринта). Таблица связей многие-ко-многим отклонена: задача в каждый момент в одном спринте или в бэклоге. Историю переездов между спринтами поле не хранит, это осознанно.

Спринт не заводит своих колонок и эпиков. На доске у задачи три независимых признака: эпик (`groupId`), колонка (`columnId`), спринт (`sprintId`). Спринт лишь решает, какие задачи видны на доске сейчас.

### Решение 2 — правила сервера

- **Один активный спринт на проект.** Проверка в сервисе (400) и частичный уникальный индекс `WHERE status = 'active'`. Триггеров не заводим.
- **`sprintId` у задачи** задаётся через `POST`/`PATCH /tasks`, как `groupId`: спринт из проекта задачи и не `closed`, иначе 400. `sprintId` без проекта — 400. При смене проекта `sprintId` обнуляется, если не прислан явно.
- **В спринте у задачи всегда есть колонка.** Если задача попадает в спринт с `columnId = null`, сервер ставит первую колонку проекта. При возврате в бэклог колонка сохраняется — как статус в Jira.
- **Эндпоинты** `projects/:projectId/sprints`:
  - список;
  - создание (имя по умолчанию «Спринт N»);
  - изменение (`name`, `goal`, даты);
  - удаление: задачи уходят в бэклог. Активный спринт тоже можно удалить;
  - `POST …/:sprintId/start { startDate, endDate, goal? }` — только из `planned` и только если нет другого активного;
  - `POST …/:sprintId/complete { moveTo: 'backlog' | <sprintId> }` — только из `active`. Незавершённые (`completed = false`) задачи переезжают в бэклог или в указанный `planned`-спринт того же проекта. Выполненные остаются в закрытом спринте.
- Даты: `startDate ≤ endDate`, иначе 400.

### Решение 3 — вкладки «Доска · Бэклог»

У agile-проекта под заголовком две вкладки-маршрута: `/tasks/project/:projectId` (доска) и `/tasks/project/:projectId/backlog`. Маршрут бэклога для обычного проекта уводит на обычный вид проекта.

### Решение 4 — доска показывает только активный спринт

- Над колонками полоса активного спринта: название, цель, «до 12 окт., осталось 5 дн.», прогресс «n из m готово» (по `task.completed`), кнопка «Завершить спринт».
- Видны только задачи с `sprintId === активный спринт`. Панель `AgileBacklogPanel` удаляется: планирование живёт только в бэклоге, как в Jira.
- Задачи, созданные на доске (верхнее поле, «+» в эпике и истории), создаются в активный спринт.
- Без активного спринта — пустое состояние «Нет активного спринта» и кнопка «Перейти в бэклог», сетки нет.

### Решение 5 — вкладка «Бэклог»

- **Слева панель «Эпики»:** эпики с историями и счётчиками, «+ Эпик», клик открывает карточку эпика (`useGroupDetail`), меню `GroupActionsMenu`. На телефоне сворачивается над списком. Фильтр бэклога по эпику — не сейчас.
- **Блоки сверху вниз:** активный спринт, запланированные (по `order`), затем «Бэклог» — задачи проекта без спринта. Кнопка «+ Создать спринт».
- **Шапка спринта:** название, даты, цель, счётчик. У `planned` — «Начать спринт» и `⋯` (изменить, удалить). У `active` — «Завершить».
- **Строка задачи:** отметка выполнения, название, метка эпика (точка цвета и название), колонка как статус. Клик открывает диалог задачи. В каждом блоке «+ задача» на месте.
- **Перенос:** перетаскивание между блоками (`vuedraggable`, как на доске, без сортировки внутри блока) и пункт «В спринт…» в меню строки.

### Решение 6 — диалоги спринта

- **«Начать спринт»:** название, цель, длительность 1 / 2 / 3 / 4 недели (по умолчанию 2), начало — сегодня, конец считается, обе даты правятся в календаре с `useLocale`. Кнопка «Начать» видна только у `planned` и только когда нет активного.
- **«Завершить спринт»:** «Выполнено 7, не выполнено 3. Незавершённые перенести в: [Спринт 2 ▾ / Бэклог]». По умолчанию ближайший `planned`, если его нет — бэклог.
- Закрытые спринты в интерфейсе не показываются, данные остаются.

### Решение 7 — диалог задачи

В agile-проекте поле «Спринт» рядом с «Эпик / История»: Бэклог, активный, запланированные. На телефоне — чип и drawer. Задача в закрытом спринте показывает «Спринт 1 (закрыт)».

### Решение 8 — данные на фронте

`sprint-store` с кэшем по проектам, как `group-store` (`sprintsOf(projectId)`, `activeSprintOf(projectId)`). Правки спринта на доске и в бэклоге идут через один стор.

### Обратная совместимость

- Новая колонка `tasks.sprintId` пересоберёт `tasks` через `synchronize`. Триггеры перед синхронизацией снимает `initializeWithSchemaSync` ([agile-epics-stories-ui.md](agile-epics-stories-ui.md)); новая таблица `sprints` без триггеров.
- API меняется только добавлением. MCP и бот не задеты.
- Ветка ещё не на проде, agile-данные есть только локально. Задачи существующих agile-проектов после изменения окажутся в бэклоге (без спринта) — миграция не нужна.
- Панель `AgileBacklogPanel` удаляется, её роль переходит к вкладке «Бэклог».

### Вне скоупа

Просмотр закрытых спринтов, burndown, ручная сортировка внутри блока бэклога, фильтр бэклога по эпику, релизы, ключи задач.

TDD: yes — бэкенд: правила `sprintId`, один активный спринт, переходы статусов и перенос незавершённых при завершении детерминированы, а ошибка тихо портит данные. Фронт: `sprint-store` и чистые функции (фильтр доски, счётчики, «осталось N дн.», выбор по умолчанию для «Завершить») — тестами первыми. Компонентные тесты Vue — после реализации, плюс проверка в живом браузере: happy-dom не видит фокус и слои модалок (урок прошлой задачи).

### Invariants

- В проекте не больше одного `active`-спринта — на уровне сервиса и индекса БД.
- Задача ссылается только на спринт своего проекта и никогда не назначается в `closed`-спринт через API задач; нарушение — 400, не 500.
- У задачи во Входящих `sprintId = null`.
- Задача в спринте всегда имеет `columnId` (если колонки у проекта есть).
- Завершение спринта не удаляет задач и не трогает выполненные; незавершённые оказываются ровно в выбранном месте.
- Удаление спринта не удаляет задач — они уходят в бэклог.
- Доска показывает только задачи активного спринта; без активного спринта задач на доске нет.
- Задача, созданная на доске, попадает в активный спринт.
- Правка спринта идёт через один `sprint-store`; копий списка нет.
- Любой календарь получает `:locale` и `:week-starts-on` из `useLocale`.

### Principles

- UI не предлагает недоступное: «Начать» только у `planned` без активного, «Завершить» только у `active`, поле «Спринт» только в agile-проекте.
- Последствия называются до подтверждения (удаление спринта, завершение с переносом).
- Отказ сервера — 400 с внятным сообщением; оптимистичное изменение на фронте откатывается.
- Переиспользуются существующие примитивы и паттерны: `group-store`-подобный кэш, `GroupActionsMenu`, `GroupDetailDialog`, `vuedraggable`, `ConfirmDialog`, `Calendar` с `useLocale`.
- Модалку закрывают до `confirm` (оба на `z-50`), пункт меню, открывающий поле ввода, отменяет возврат фокуса (CLAUDE.md).

## Plan

Approach: снизу вверх, как в прошлых задачах. Сначала спринт на бэкенде и правила `sprintId` у задачи, затем слой данных фронта, потом UI по экранам: доска, бэклог, диалоги спринта, диалог задачи. Каждая UI-фаза опирается на готовый стор, и её можно проверить в браузере отдельно.

### Phase 1 — бэкенд: сущность и API спринта (TDD)

- **1.1** `alfy-bot/src/shared/entities/sprint.entity.ts` (create) — `Sprint`: `id` uuid, `userId`, `projectId` (FK `Project`, `CASCADE`), `name`, `goal: string | null`, `startDate`/`endDate: string | null` (text, `YYYY-MM-DD`), `status: 'planned' | 'active' | 'closed'` (default `planned`), `completedAt: Date | null`, `order`, `createdAt`/`updatedAt`.
  - `@Check('CHK_sprint_status', "status IN ('planned','active','closed')")`, `@Check('CHK_sprint_date_order', 'startDate IS NULL OR endDate IS NULL OR startDate <= endDate')`, `@Index('IDX_sprint_one_active', ['projectId'], { unique: true, where: "status = 'active'" })`.
  - Invariant: не больше одного `active` на проект — на уровне БД.
- **1.2** `shared/entities/index.ts`, `app.module.ts:62-80` (список сущностей), `test/helpers/test-app.ts:40-55` (modify) — `Sprint` во всех трёх списках.
- **1.3** `alfy-bot/src/modules/project/domain/sprint-repository.port.ts` (create) — `SprintRepositoryPort`: `findAllByProject(projectId): Promise<Sprint[]>`, `findById(id, projectId): Promise<Sprint | null>`, `findActive(projectId): Promise<Sprint | null>`, `create(data: Partial<Sprint>): Promise<Sprint>`, `save(sprint): Promise<Sprint>`, `delete(id, projectId): Promise<boolean>`, `closeAndMoveUnfinished(sprintId: string, moveToSprintId: string | null): Promise<void>` — одна транзакция: `status = 'closed'`, `completedAt = now`, у задач спринта с `completed = false` `sprintId = moveToSprintId`.
- **1.4** `alfy-bot/src/modules/project/infrastructure/typeorm-sprint.repository.ts` (create) — реализация по образцу `typeorm-board-group.repository.ts`; `closeAndMoveUnfinished` через `dataSource.transaction`.
- **1.5** `alfy-bot/src/modules/project/dto/create-sprint.dto.ts`, `update-sprint.dto.ts`, `start-sprint.dto.ts`, `complete-sprint.dto.ts` (create)
  - create: `name?`, `goal?`; update: `name?`, `goal?: string | null`, `startDate?`/`endDate?: string | null` (`@Matches(/^\d{4}-\d{2}-\d{2}$/)`); start: `startDate`, `endDate` (обязательны), `goal?`; complete: `moveTo: string` — `'backlog'` или UUID (`@ValidateIf` + `@IsUUID`).
- **1.6** `alfy-bot/src/modules/project/sprint.service.ts` (create) — `SprintService`, доступ к проекту как в `BoardGroupService.validateProjectAccess`:
  - `list(userId, projectId)` — все спринты проекта, включая `closed` (нужны для подписи «Спринт 1 (закрыт)» в диалоге задачи), по `order`; экраны фильтруют незакрытые сами;
  - `create(userId, projectId, dto)` — имя по умолчанию `Спринт ${n}`, где `n` = число всех спринтов проекта + 1; `order` = число незакрытых;
  - `update(userId, projectId, id, dto)` — `closed` менять нельзя (400); даты `startDate ≤ endDate` (400);
  - `start(userId, projectId, id, dto)` — только из `planned` (иначе 400), при существующем `active` — 400 «Another sprint is already active»;
  - `complete(userId, projectId, id, dto)` — только из `active`; `moveTo` = `'backlog'` или `planned`-спринт этого проекта (иначе 400) → `closeAndMoveUnfinished`;
  - `delete(userId, projectId, id)` — задачи уходят в бэклог через FK `SET NULL`.
  - Invariant: завершение не трогает выполненные и не удаляет задачи; удаление спринта не удаляет задач.
- **1.7** `alfy-bot/src/modules/project/sprint.controller.ts` (create) — `@Controller('projects/:projectId/sprints')`: `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`, `POST /:id/start`, `POST /:id/complete`. Литеральные подпути многосегментные — коллизий с `:id` нет.
- **1.8** `alfy-bot/src/modules/project/project.module.ts:23-45` (modify) — `Sprint` в `forFeature`, биндинг порта, сервис, контроллер.
- Commit: `feat(project): sprints with start and complete`

### Phase 2 — бэкенд: `sprintId` у задачи (TDD)

- **2.1** `alfy-bot/src/shared/entities/task.entity.ts:64,114-119` (modify) — `sprintId: string | null` + `@ManyToOne(() => Sprint, { nullable: true, onDelete: 'SET NULL' })`.
- **2.2** `alfy-bot/src/modules/task/domain/sprint-query.port.ts` (create) — `SprintQueryPort`: `getSprint(sprintId): Promise<{ projectId: string, status: 'planned' | 'active' | 'closed' } | null>`, `firstColumnId(projectId): Promise<string | null>` (колонка с минимальным `order`). Русский TSDoc.
- **2.3** `alfy-bot/src/modules/task/infrastructure/typeorm-sprint-query.adapter.ts` (create) — читает `sprints` и `project_columns` напрямую, с той же 1–2-строчной причиной про цикл модулей, что у `TypeOrmBoardGroupQueryAdapter`.
- **2.4** `alfy-bot/src/modules/task/task.module.ts:50-78` (modify) — `Sprint`, `ProjectColumn` в `forFeature` (если ещё нет), биндинг порта.
- **2.5** `alfy-bot/src/modules/task/dto/create-task.dto.ts:111-117` (modify) — `sprintId?: string | null`, как `groupId`.
- **2.6** `alfy-bot/src/modules/task/task.service.ts` (modify)
  - `private assertSprintAssignable(sprintId: string, projectId: string | null): Promise<void>` — без проекта → 400 «Cannot assign a sprint to a task without a project»; чужой проект или нет спринта → 400 «Sprint does not belong to the task project»; `closed` → 400 «Cannot assign a task to a closed sprint».
  - `create` (`:69-114`): при `sprintId` проверка до `taskRepo.create`; если `columnId` не задан — `firstColumnId(projectId)`.
  - `update` (`:199-262`): при `dto.sprintId` (не `undefined`, не `null`) — проверка против целевого проекта; если у задачи после применения `columnId === null` — `firstColumnId`. При смене проекта `sprintId` обнуляется, если не прислан явно (как `groupId` на `:260`).
  - `moveToInbox` (`:~615`): `task.sprintId = null` рядом с `groupId = null`.
  - Invariant: спринт только своего проекта и не `closed`; во Входящих `sprintId = null`; в спринте у задачи есть колонка.
- **2.7** `alfy-bot/src/modules/project/project-task.service.ts` `moveTask` + `TaskRepositoryPort.updatePosition` (`task-repository.port.ts:35-42`, `typeorm-task.repository.ts:118-132`) (modify) — `updatePosition` получает параметр `sprintId: string | null` после `groupId`; `moveTask` передаёт `keepsProject ? task.sprintId : null` — при переезде в другой проект спринт обнуляется, внутри проекта не трогается.
- Commit: `feat(task): assign tasks to sprints`

### Phase 3 — фронт: слой данных (TDD)

- **3.1** `alfy-bot-frontend/src/features/projects/model/types.ts` (modify) — `SprintStatus`, `Sprint` (поля как в 1.1), `CreateSprintPayload`, `UpdateSprintPayload`, `StartSprintPayload`, `CompleteSprintPayload { moveTo: 'backlog' | string }`.
- **3.2** `features/tasks/model/types.ts:44-47` (modify) — `Task.sprintId?: string | null`.
- **3.3** `features/projects/api/sprints-api.ts` (create) — `fetchSprints`, `createSprint`, `updateSprint`, `deleteSprint`, `startSprint`, `completeSprint`, по образцу `groups-api.ts`.
- **3.4** `features/projects/model/sprint-store.ts` (create) — по образцу `group-store.ts`: `lists = ref<Record<string, Sprint[]>>`, `sprintsOf(projectId)`, `activeSprintOf(projectId): Sprint | null`, `plannedSprintsOf(projectId)`, `isLoading`, `fetchSprints`, `ensureSprints`, `createSprint`, `updateSprint`, `deleteSprint` (после успеха задачам спринта локально `sprintId = null`), `startSprint`, `completeSprint(projectId, id, moveTo)` (после успеха незавершённым задачам локально `sprintId` = цель). Оптимизм и откат — как в `group-store`.
- **3.5** `features/projects/lib/sprint.ts` (create) — чистые функции:
  - `sprintTasks(tasks, sprintId: string | null, projectId): Task[]` (`null` = бэклог проекта);
  - `sprintProgress(tasks, sprintId) → { done, total }`;
  - `daysLeft(endDate: string, today: Date): number` (локальные даты, 0 в последний день, отрицательное после конца);
  - `defaultCompleteTarget(planned: Sprint[]): 'backlog' | string` — первый `planned` по `order`, иначе `'backlog'`;
  - `sprintEndFromDuration(start: Date, weeks: 1 | 2 | 3 | 4): Date`.
- **3.6** `features/projects/lib/sprint.ts` — ещё `sprintDeletionMessage(sprint: Sprint, taskCount: number): string` («Удалить „Спринт 2“? 3 задачи вернутся в бэклог.», `pluralRu`, без второго предложения при 0 задач).
- Invariant: один `sprint-store`, копий списка нет.
- Commit: `feat(projects): sprint store and helpers`

### Phase 4 — фронт: вкладки и доска активного спринта

- **4.1** `alfy-bot-frontend/src/router/index.ts:46-50` (modify) — дочерний маршрут `project/:projectId/backlog`, `name: 'tasks-project-backlog'`, компонент `views/ProjectBacklogView.vue`.
- **4.2** `features/projects/ui/ProjectTabs.vue` (create) — две ссылки-вкладки «Доска · Бэклог» (`RouterLink`, активная по имени маршрута), рендерится только для agile-проекта.
- **4.3** `features/projects/ui/SprintBanner.vue` (create) — props `projectId`; полоса активного спринта: название, цель, «до 12 окт., осталось N дн.» (`daysLeft`, формат через `formatDate` из `useLocale`), `sprintProgress`, кнопка «Завершить спринт» → emit `complete`.
- **4.4** `views/ProjectView.vue` (modify)
  - agile-ветка (`:174-210`): `ProjectTabs` под заголовком; `ensureSprints(projectId)`; без активного спринта — пустое состояние «Нет активного спринта» + кнопка на `tasks-project-backlog`, без `TaskForm` и доски; с активным — `SprintBanner`, `TaskForm`, `AgileBoardView` на всю ширину.
  - `AgileBacklogPanel` удаляется из шаблона и импортов (`:11,202`).
  - `handleAddTask` (`:105`) для agile-проекта добавляет `sprintId` активного спринта (колонку ставит сервер).
- **4.5** `features/projects/ui/AgileBoardView.vue` (modify) — `projectTasks` фильтруется ещё и по `sprintId === activeSprintOf(projectId)?.id`; `handleCreateTask` (`:107-115`) передаёт `sprintId`.
  - Invariant: доска показывает только задачи активного спринта; задача с доски попадает в активный спринт.
- **4.6** `features/projects/ui/AgileBacklogPanel.vue` и `tests/features/projects/ui/AgileBacklogPanel.spec.ts` (delete); в `use-agile-dnd.ts` убрать ветки, существующие только для панели (перенос в `columnId = null`), если после удаления панели они мертвы.
- Commit: `feat(projects): board tabs and active sprint board`

### Phase 5 — фронт: вкладка «Бэклог»

- **5.1** `views/ProjectBacklogView.vue` (create) — для не-agile проекта `router.replace` на `tasks-project`; `AppHeader` + `ProjectTabs`; двухколоночная раскладка (на мобильном — колонка), слева `BacklogEpicsPanel`, справа блоки: активный спринт, `plannedSprintsOf`, затем бэклог; кнопка «+ Создать спринт» → `createSprint`. Использует `useTaskDetailHandlers` и монтирует `TaskDetailDialog`, как `ProjectView`.
- **5.2** `features/projects/ui/BacklogEpicsPanel.vue` (create) — эпики с историями и счётчиками (`groupProgress`), «+ Эпик» (`InlineTitleInput`), `GroupActionsMenu` с теми же обработчиками, что на доске (`useGroupDeletion`, `useGroupDetail`). На мобильном сворачивается (кнопка-заголовок «Эпики»).
- **5.3** `features/projects/ui/SprintBlock.vue` (create) — props `projectId`, `sprint: Sprint | null` (`null` = бэклог), `tasks: Task[]`; шапка (название/«Бэклог», даты, цель, счётчик; у `planned` — «Начать спринт» и `⋯` «Изменить» / «Удалить»; у `active` — «Завершить»), список `vuedraggable` (`group: 'sprint-backlog'`, `sort: false`) из `BacklogTaskRow`, внизу «+ задача» (`InlineTitleInput`). Emits: `start`, `complete`, `edit`, `delete`, `moveTask: [taskId, sprintId | null]`, `createTask: [title]`, `openTask`, `toggleTask`.
- **5.4** `features/projects/ui/BacklogTaskRow.vue` (create) — отметка выполнения, название, метка эпика (`groupPath` → точка цвета + название), колонка как бейдж статуса, меню `⋯` → подменю «В спринт…» (Бэклог + активный + `planned`, текущий отмечен).
- **5.5** Перенос: `moveTask` → `taskStore.updateTask(id, { sprintId })`; колонку, если её не было, ставит сервер — ответ `PATCH` уже обновляет задачу через `applyUpdateResponse`.
- Commit: `feat(projects): backlog tab with sprints and epics panel`

### Phase 6 — фронт: диалоги спринта

- **6.1** `features/projects/ui/SprintFormDialog.vue` (create) — режимы `start` и `edit`; поля: название, цель, в режиме `start` — длительность 1/2/3/4 недели (по умолчанию 2, начало сегодня, конец через `sprintEndFromDuration`), даты правятся в `Popover` + `Calendar` с `:locale`/`:week-starts-on` из `useLocale`, `min`/`max` друг относительно друга. `start` → `sprintStore.startSprint`, `edit` → `updateSprint`.
- **6.2** `features/projects/ui/SprintCompleteDialog.vue` (create) — «Выполнено N, не выполнено M», выбор цели: `plannedSprintsOf` + «Бэклог», по умолчанию `defaultCompleteTarget`; → `completeSprint`.
- **6.3** Удаление спринта из меню `SprintBlock` — `confirm` с текстом «Удалить „Спринт 2“? N задач вернутся в бэклог.» (`pluralRu`), затем `deleteSprint`.
- **6.4** Подключение: `SprintBanner` (доска) и `SprintBlock` (бэклог) открывают эти диалоги. Модалка закрывается до `confirm`; пункты меню, открывающие поле ввода, отменяют `closeAutoFocus` (как `GroupActionsMenu`).
  - Principle: «Начать» видна только у `planned` при отсутствии активного, «Завершить» — только у `active`.
- Commit: `feat(projects): start, edit, complete and delete sprints`

### Phase 7 — фронт: поле «Спринт» в диалоге задачи

- **7.1** `features/projects/ui/SprintPickerContent.vue`, `SprintPicker.vue` (create) — по образцу `GroupPickerContent`/`GroupPicker`: варианты «Бэклог», активный, `planned`. Если задача в закрытом спринте, значение поля — «Спринт 1 (закрыт)»: имя берётся из `sprintsOf(projectId)`, где закрытые есть (см. 1.6).
- **7.2** `features/tasks/ui/TaskDetailDialog.vue:288,526,664-683` (modify) — `localSprintId`, `onSprintChange` → `emitUpdate({ sprintId })`; `<SprintPicker v-if="isAgileProject">` после `GroupPicker`; `DrawerField` + `'sprint'`, drawer с `SprintPickerContent`; при смене проекта `localSprintId = null` локально; `ensureSprints` при agile.
- **7.3** `features/tasks/ui/TaskPropertyChips.vue` (modify) — `sprintTitle?: string | null` по той же схеме, что `groupTitle` (`undefined` — чип скрыт).
- Commit: `feat(tasks): sprint field in the task dialog`

### Test strategy

TDD, тесты первыми — фазы 1–3:

- `sprint.service.spec.ts`:
  - создание: имя «Спринт N» по умолчанию;
  - `start` из `planned` → `active`; повторный `start` при уже активном → 400; `start` из `closed`/`active` → 400;
  - `complete` только из `active`; `moveTo: 'backlog'` и `moveTo: <planned>` → `closeAndMoveUnfinished` с правильной целью; `moveTo` на `active`/`closed`/чужой проект → 400;
  - `update` закрытого → 400; `startDate > endDate` → 400.
- `typeorm-sprint.repository` на реальном in-memory SQLite: `closeAndMoveUnfinished` двигает только незавершённые задачи этого спринта и ставит `closed`; уникальный индекс не даёт второй `active`.
- `task.service.spec.ts`:
  - `create`/`update` со спринтом своего проекта → ок, `columnId = null` → первая колонка;
  - чужой проект, `closed`-спринт, без проекта → 400;
  - смена проекта без `sprintId` → обнулён; `moveToInbox` → `sprintId = null`.
- e2e `board-groups.e2e-spec.ts` (или новый `sprints.e2e-spec.ts` по его образцу): создать → начать → задача в спринт (колонка проставлена) → второй `start` → 400 → завершить с переносом в `planned` → незавершённая задача в новом спринте, выполненная осталась в закрытом; удаление спринта → задачи с `sprintId = null`.
- Фронт:
  - `sprint.spec.ts` — `daysLeft` (сегодня = конец → 0, после конца → отрицательное), `defaultCompleteTarget` (с `planned` / без), `sprintProgress`, `sprintTasks(null)` = бэклог проекта, `sprintEndFromDuration`;
  - `sprint-store.spec.ts` — изоляция проектов, `activeSprintOf`, откат при ошибке, локальный эффект `deleteSprint` и `completeSprint` на задачи.

После реализации:

- `ProjectView.spec.ts` — без активного спринта: пустое состояние, нет доски и `TaskForm`; с активным: `SprintBanner` и доска; `AgileBacklogPanel` не рендерится.
- `AgileBoardView.spec.ts` — задачи другого спринта и бэклога не видны; `+` создаёт задачу с `sprintId`.
- `ProjectBacklogView.spec.ts` / `SprintBlock.spec.ts` — порядок блоков; «Начать» скрыта при активном; пункт «В спринт…» вызывает `updateTask` с `sprintId`; «+ задача» в блоке спринта шлёт его `sprintId`, в бэклоге — `null`.
- `SprintFormDialog.spec.ts`, `SprintCompleteDialog.spec.ts` — длительность по умолчанию 2 недели, календари получают `locale`, цель завершения по умолчанию.
- `TaskDetailDialog.spec.ts` — поле «Спринт» только в agile, выбор шлёт `sprintId`, закрытый показывается как «(закрыт)».
- Проверка в живом браузере в `up:uverify`: фокус после меню, слой подтверждения над модалкой, перетаскивание между блоками (vuedraggable, в отличие от кастомного движка, встроенным браузером управляется).

### Order & dependencies

1 → 2 (адаптер читает `sprints`) → 3 → 4 → 5 → 6 → 7. Фазы 4 и 5 можно закоммитить до 6: кнопки «Начать»/«Завершить» открывают диалоги из фазы 6, до неё они временно без обработчика — поэтому 4–6 проверяются в браузере только после фазы 6.

### Open questions / risks / rollback

- **Совместимость.** Колонка `tasks.sprintId` пересоберёт `tasks`; `initializeWithSchemaSync` снимает триггеры до синхронизации. Новая таблица `sprints` без триггеров. Частичный уникальный индекс SQLite поддерживает; проверяется тестом репозитория (фаза 1).
- **Существующие agile-задачи** (только локальные, «Alfy 2.0») после фазы 4 пропадут с доски в бэклог — ожидаемо, по Design.
- **`GET /sprints` отдаёт и закрытые** (нужны для подписи «Спринт 1 (закрыт)» в диалоге задачи); экраны показывают только незакрытые — фильтр в сторе. При большом числе закрытых спринтов список растёт; пагинация — не сейчас.

## Verify
<empty — filled by up:uverify>

## Conclusion
<empty — filled by up:ureview>

### Deviations from plan

- Фаза 1 (`05a4811`) заранее добавила колонку `Task.sprintId` и связь: без неё нельзя было написать и проверить `closeAndMoveUnfinished`. В четыре спеки со своими `DataSource` пришлось добавить сущность `Sprint`. `start`/`complete` отвечают 201 (`@Post` по умолчанию); `start` дополнительно проверяет `startDate ≤ endDate`.
- `752219f` (вне фаз): при смене проекта через `PATCH /tasks` без `columnId` колонка теперь сбрасывается. Раньше у задачи оставалась колонка старого проекта, и на доске нового она не показывалась; со спринтами из-за этого не срабатывало автозаполнение колонки. Повторная отправка текущего `sprintId` больше не проверяется: сохранение задачи из закрытого спринта раньше давало 400.
- `4f79c16` (вне фаз): во фронтовых типах имя при создании спринта сделано необязательным (сервер называет «Спринт N»), в `UpdateSprintPayload` добавлены даты для диалога «Изменить».
- Фазы 4–5: кнопки спринта до фазы 6 были скрыты пропами (`canComplete`, `canStart`, `canManage`), а не привязаны к пустым обработчикам; фаза 6 их включила. В бэклог добавлено меню `TaskListOptionsMenu`: без него настройки «показывать выполненные / скрывать просроченные» на этой вкладке нельзя было переключить.
- Фаза 6: общий `lib/api-error.ts` для показа сообщения сервера в диалогах. Диалоги спринта монтируются через `v-if` на снимке спринта, а не выводятся из стора: оптимистичная смена статуса иначе размонтировала бы диалог до закрытия.

### Known risks

- Одновременный двойной «Начать спринт» упирается в уникальный индекс БД и получает 500, а не 400: проверка в сервисе закрывает только обычный случай.
- Эндпоинты спринтов не проверяют, что проект agile.
- В режиме «Начать» имя спринта сохраняется отдельным `updateSprint` до `startSprint`. Если старт потом не удастся, новое имя останется, но ошибка будет показана.
