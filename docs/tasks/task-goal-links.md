# Связь задач с целями

**Status:** reviewing
**Branch:** feat/task-goal-links
**Worktree:** /Users/v/projects/Alfy
**Mode:** interactive

## Design

Двусторонняя связь задача ↔ цель. Привычки (`kind='question'`) вне скоупа. Завершение задачи не меняет `status`/`outcome` цели. Отвязка ≠ удаление задачи. Recurring: линк на живую строку, не на `__virtual__`. DnD на цели в сайдбаре нет.

Таблица `links` (имя под будущие привычки), не колонка `goalId` на `tasks` и не `task_goals`:

```
links
  task_id    uuid
  user_id    int
  kind       text     -- сейчас только 'goal'
  target_id  int      -- goal id
  UNIQUE(task_id, kind, target_id)
```

Индексы: `(user_id, kind, task_id)`, `(user_id, kind, target_id)`.

`projectId` = полка (inbox/проект). Goal-link = стикер. Несколько целей на задачу ок.

Загрузка `GET /tasks`: не TypeORM `relations` join (N целей → дубли строк). Два запроса: `findAllByUser`, затем `SELECT task_id, target_id FROM links WHERE kind='goal' AND user_id=? AND task_id IN (...)`, маппинг в `goalIds: number[]`.

API отдельно от `PATCH /tasks/:id`:

- `PUT /tasks/:id/goals` `{ goalIds: number[] }` — replace-set
- `GET /goals/:id/tasks` — задачи цели
- `PUT /goals/:id/tasks` `{ taskIds: uuid[] }` — тот же join
- `GET /tasks` отдаёт `goalIds: number[]` (`[]` если нет)
- `POST /tasks` опционально `goalIds` (создание с GoalView)

Цикл модулей: `GoalModule` импортирует `TaskModule`. `TaskModule` не импортирует `GoalModule`. Ownership целей — через `TypeOrmModule.forFeature([Goal])` в адаптере линков. `synchronize: true`, файлов миграций нет.

TDD: yes (replace-set, чужая цель/задача → 404, пустой набор снимает все связи, виртуальный id → 400, `GET /tasks` без дублей при 3 целях).

### Invariants

- Связь живёт только в `links` с `kind='goal'`. Колонки `goalId` на `tasks` нет.
- `UNIQUE(task_id, kind, target_id)`. Одна задача — много целей, одна цель — много задач.
- Все выборки линков фильтруют `user_id`. Чужой `goalId`/`taskId` → 404, набор не применяется частично.
- `PUT` — replace-set. `goalIds: []` / `taskIds: []` снимает связи, задачи/цели не удаляет.
- `__virtual__` id нельзя линковать (400).
- `GET /tasks` не джойнит `links` через TypeORM relations. `goalIds` навешивается отдельным запросом.
- Завершение задачи не трогает `Goal.status` / `Goal.outcome`.
- Новый живой инстанс recurring (complete → next) копирует goal-links со старой строки.
- `TaskModule` не импортирует `GoalModule`.
- Привычки/`kind='question'`, MCP-tools линков, автозакрытие цели, DnD на цели — не делаем.

### Principles

- Линк — отдельный ресурс, не поле `PATCH /tasks/:id`.
- Адаптер линков знает про таблицу `goals` только для ownership-проверки, не для бизнес-логики целей.
- Фронт читает `goalIds` с задачи; имена целей — только в пикере/диалоге.

### Assumptions

- `synchronize: true` создаст таблицу на старте.
- Цели со статусом `deleted` нельзя привязать; уже существующие орфан-id на карточке допустимы до следующего replace.
- `GET /tasks` уже кормит список и календарь — `goalIds` едет тем же payload.

## Plan

Approach: таблица `links` + порт в task-модуле; replace-set эндпоинты с двух сторон; фронт — пикер как ProjectPicker (мультичекбокс), бейдж/иконка, блок на GoalView.

### PH1 — backend links API

- **1.1** `alfy-bot/src/shared/entities/link.entity.ts` (create)
  - `Link { id, userId, taskId, kind, targetId }` + Unique + индексы + `ManyToOne Task onDelete CASCADE`
  - Respects: IV1, IV2
- **1.2** `alfy-bot/src/shared/entities/index.ts`, `alfy-bot/src/app.module.ts:58-72` (modify)
  - экспорт + регистрация `Link` в `entities`
- **1.3** `alfy-bot/src/shared/entities/task.entity.ts` (modify)
  - виртуальное `goalIds?: number[]` (не колонка)
- **1.4** `alfy-bot/src/modules/task/domain/task-link.port.ts` (create)
  - `TaskLinkPort.findGoalIdsByTaskIds(userId, taskIds) -> Map<string, number[]>`
  - `replaceGoalLinks(userId, taskId, goalIds) -> void`
  - `findTaskIdsByGoal(userId, goalId) -> string[]`
  - `replaceTaskLinksForGoal(userId, goalId, taskIds) -> void`
  - `filterOwnedGoalIds(userId, goalIds) -> number[]`
  - `copyGoalLinks(userId, fromTaskId, toTaskId) -> void`
- **1.5** `alfy-bot/src/modules/task/infrastructure/typeorm-task-link.repository.ts` (create)
- **1.6** `alfy-bot/src/modules/task/domain/task-repository.port.ts` + `typeorm-task.repository.ts` (modify)
  - `findByIds(userId, ids) -> Task[]`
- **1.7** `alfy-bot/src/modules/task/dto/set-task-goals.dto.ts`, `create-task.dto.ts`, `update-task.dto.ts` (create/modify)
  - `SetTaskGoalsDto { goalIds: number[] }`
  - optional `goalIds` на create; `goalIds?: never` на update
- **1.8** `alfy-bot/src/modules/goal/dto/set-goal-tasks.dto.ts` (create)
  - `SetGoalTasksDto { taskIds: string[] }`
- **1.9** `alfy-bot/src/modules/task/task.service.ts` (modify)
  - `getAll`/`create`/`update`/`incrementPomodoro`/`materialize` навешивают `goalIds`
  - `replaceGoalLinks`, `listByGoal`, `replaceTaskLinksForGoal`
  - `completeRecurringTask` копирует линки на новый инстанс
- **1.10** `alfy-bot/src/modules/task/task.controller.ts` (modify)
  - `PUT :id/goals` до generic `:id`
- **1.11** `alfy-bot/src/modules/goal/goal.controller.ts` + `goal.module.ts` (modify)
  - `GET/PUT :id/tasks`; `GoalModule` imports `TaskModule`
- **1.12** `alfy-bot/src/modules/task/task.module.ts` (modify)
  - `forFeature([Link, Goal])`, биндинг `TaskLinkPort`
- **1.13** `alfy-bot/src/modules/task/task.service.spec.ts` (modify)
  - мок `TaskLinkPort` в `beforeEach`
  - `describe('goal links')`: replace-set, empty unlink, чужая цель 404, virtual 400, getAll мапит goalIds без дублей, create с goalIds, copy на recurring complete
- Commit: `feat(tasks): link tasks to goals via links table`

### PH2 — frontend picker / card / calendar / GoalView

- **2.1** `alfy-bot-frontend/src/features/tasks/model/types.ts` — `goalIds?: number[]`
- **2.2** `task-store.ts` — `parseTask` + `setTaskGoals`; exclude `goalIds` из PATCH
- **2.3** `src/api/goals.ts` — `fetchGoalTasks`, `setGoalTasks`
- **2.4** `features/goals/ui/GoalPicker.vue` + `GoalPickerContent.vue` (create)
  - как ProjectPicker, мультичекбокс, immediate PUT
- **2.5** `TaskDetailDialog.vue` + `TaskPropertyChips.vue` — ряд под проектом, drawer `goals`
- **2.6** `TaskCard.vue` — Target + «Цель» / «N цели»
- **2.7** `CalendarEventBlock.vue` — Target 10px рядом с Repeat/Flag
- **2.8** `views/GoalView.vue` — блок «Задачи»: список, создать с `goalIds`, привязать существующую, отвязать
- **2.9** тесты: `TaskCard.spec.ts`, `CalendarEventBlock.spec.ts`, `GoalView.spec.ts`; MSW `PUT /tasks/:id/goals`
- Commit: `feat(web): attach tasks to goals in dialog, card, calendar, GoalView`

### Interfaces

```
TaskLinkPort
  findGoalIdsByTaskIds(userId, taskIds) -> Map<taskId, goalIds>
  replaceGoalLinks(userId, taskId, goalIds)
  findTaskIdsByGoal(userId, goalId) -> taskIds
  replaceTaskLinksForGoal(userId, goalId, taskIds)
  filterOwnedGoalIds(userId, goalIds) -> ownedIds
  copyGoalLinks(userId, fromTaskId, toTaskId)

Task.goalIds?: number[]          // virtual, JSON only
PUT /tasks/:id/goals             { goalIds } -> { goalIds }
GET /goals/:id/tasks             -> Task[]
PUT /goals/:id/tasks             { taskIds } -> { taskIds }
POST /tasks                      goalIds?: number[]
```

### Interface graph

```
GoalController --TaskService--> TaskLinkPort
TaskController --TaskService--> TaskLinkPort
TaskService.getAll --> TaskRepositoryPort + TaskLinkPort.findGoalIdsByTaskIds
GoalPicker --> PUT /tasks/:id/goals --> taskStore.setTaskGoals
GoalView --> GET /goals/:id/tasks + POST /tasks(goalIds)
```
