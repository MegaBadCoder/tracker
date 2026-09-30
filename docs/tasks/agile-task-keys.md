# Ключи задач с префиксом проекта (ALF-12)

**Status:** executing
**Branch:** feat/agile-board
**Worktree:** .worktrees/feat-agile-board
**Mode:** hands-off

## Design

### Зачем

Короткий ключ `ALF-12` — стабильное имя задачи: его удобно назвать в разговоре, вписать в коммит, найти глазами на доске и в бэклоге. Этап Jira-подобного agile после спринтов и релизов ([agile-sprints.md](agile-sprints.md), [agile-releases.md](agile-releases.md)).

### Решения пользователя

- Ключи только в agile-проектах.
- При переезде в другой проект задача получает новый номер в новом проекте (из agile задача уходит только в agile — [agile-project-type.md](agile-project-type.md)).
- Префикс можно менять, ключи меняются сразу: хранится только номер, префикс берётся из проекта.

### Решение 1 — данные

- `Project.taskKeyPrefix: string | null` — `^[A-Z][A-Z0-9]{1,9}$`, уникален среди проектов пользователя (частичный уникальный индекс `userId + taskKeyPrefix WHERE taskKeyPrefix IS NOT NULL` + 400 в сервисе). Задаётся только у agile-проекта (у обычного — 400). Можно изменить или очистить.
- `Project.nextTaskNumber: integer` (default 1) — счётчик номеров.
- `Task.number: integer | null` — номер внутри проекта; частичный уникальный индекс `projectId + number WHERE number IS NOT NULL`. У задач обычных проектов и Входящих `null`.
- Ключ = `${prefix}-${number}`, собирается на фронте. Без префикса ключ не показывается (номер при этом выдаётся — появится, когда префикс зададут).

### Решение 2 — выдача номера

- Один порт в task-модуле `TaskNumberPort.allocate(projectId): Promise<number | null>` — атомарно `UPDATE projects SET nextTaskNumber = nextTaskNumber + 1 WHERE id = ? AND type = 'agile' RETURNING nextTaskNumber - 1`; для не-agile — `null`.
- Номер выдаётся во всех путях появления задачи в agile-проекте: `TaskService.create`, создание экземпляров повторяющейся задачи (`TaskService` — два места), `OverdueRecurringService` → `freezeAndCreateNext`, смена проекта в `TaskService.update` и `ProjectTaskService.moveTask` (новый номер в целевом проекте; при уходе в не-agile — `null`).
- Номера не переиспользуются: счётчик только растёт, удаление задачи дыру не заполняет.

### Решение 3 — существующие задачи

Идемпотентный `TaskNumberMigrationService` в `shared/database/`: задачам agile-проектов без номера выдаёт номера по `createdAt`, начиная с `nextTaskNumber`, и сдвигает счётчик. Префиксы существующим проектам не проставляются — задаются в настройках.

### Решение 4 — интерфейс

- **Настройки проекта** (`ProjectEditDialog`) у agile-проекта: поле «Префикс задач» (верхний регистр на вводе, подсказка формата, ошибка сервера в диалоге). **Создание** (`ProjectCreateDialog`): то же поле при выборе «Agile», необязательное.
- **Показ ключа** — мелким приглушённым моноширинным текстом перед названием: карточка задачи (`TaskCard`), строка бэклога (`BacklogTaskRow`), строка задачи в релизе (`ReleaseRow`), шапка диалога задачи (`TaskDetailDialog`, после крошек). Одна функция `taskKey(project, task): string | null`.

### Вне скоупа

Поиск и переход по ключу, ключи в MCP и боте, упоминания ключей в тексте, ключи для эпиков и историй.

### Обратная совместимость

Три новые колонки (`projects.taskKeyPrefix`, `projects.nextTaskNumber`, `tasks.number`) — пересборка таблиц через `initializeWithSchemaSync` (триггеры снимаются). API только расширяется. Ветка не на проде.

TDD: yes — выдача номеров, уникальность, валидация префикса и backfill детерминированы, ошибка тихо ломает ключи. Фронт: `taskKey` — тестом первым; компоненты — после, плюс живой браузер.

### Invariants

- В одном проекте номер не повторяется (сервис + уникальный индекс); счётчик только растёт.
- Каждая задача agile-проекта имеет номер после любого пути появления (создание, повтор, переезд) и после backfill.
- У задач обычных проектов и Входящих `number = null`.
- Префикс только у agile-проекта, по формату, уникален среди проектов пользователя; нарушение — 400, не 500.
- Ключ не показывается без префикса; ключ собирается одной функцией `taskKey`.

### Principles

- Хранится номер, не ключ — смена префикса не требует миграции задач.
- Отказ сервера — 400 с внятным сообщением.
- Переиспользуются существующие паттерны: порт в task-модуле с адаптером (как `SprintQueryPort`), идемпотентный `*MigrationService`.

## Plan

Approach: сначала бэкенд целиком (колонки, порт выдачи, все пути создания и переезда, backfill), затем фронт (тип, `taskKey`, поля настроек, показ ключа).

### Phase 1 — бэкенд (TDD)

- **1.1** `shared/entities/project.entity.ts` — `taskKeyPrefix: string | null` (text, nullable), `nextTaskNumber: number` (integer, default 1), `@Index('IDX_project_task_key_prefix', ['userId', 'taskKeyPrefix'], { unique: true, where: 'taskKeyPrefix IS NOT NULL' })`.
- **1.2** `shared/entities/task.entity.ts` — `number: number | null` (integer, nullable), `@Index('IDX_task_project_number', ['projectId', 'number'], { unique: true, where: 'number IS NOT NULL' })`.
- **1.3** `modules/project/dto/create-project.dto.ts`, `update-project.dto.ts` — `taskKeyPrefix?: string | null`: `@ValidateIf(o => o.taskKeyPrefix !== undefined && o.taskKeyPrefix !== null)` + `@Matches(/^[A-Z][A-Z0-9]{1,9}$/)`.
- **1.4** `modules/project/project.service.ts` — `create`/`update`: префикс только у `type === 'agile'` (иначе 400 «Task key prefix is only for agile projects»), уникальность среди проектов пользователя (400 «Task key prefix is already used»); `nextTaskNumber` из DTO не принимается.
- **1.5** `modules/task/domain/task-number.port.ts` + `infrastructure/typeorm-task-number.adapter.ts` (create) — `TaskNumberPort.allocate(projectId: string | null): Promise<number | null>` (`null` проект → `null` без запроса); атомарный `UPDATE … RETURNING`. Русский TSDoc, причина размещения адаптера в task-модуле (цикл модулей) — 1–2 строки. `task.module.ts` — биндинг.
- **1.6** `modules/task/task.service.ts`:
  - `create` — `taskData.number = await taskNumbers.allocate(projectId)`;
  - два пути создания экземпляров повторяющейся задачи (`:~209`, `:~449`) — номер для экземпляра;
  - `update` — при `isChangingProject` `task.number = await allocate(target)` до сохранения.
- **1.7** `modules/task/overdue-recurring.service.ts` — `successorData.number = await allocate(task.projectId)` перед `freezeAndCreateNext`.
- **1.8** `modules/project/project-task.service.ts` `moveTask` + `TaskRepositoryPort.updatePosition`/`typeorm-task.repository.ts` — параметр `number: number | null` после `releaseId`; при `keepsProject` — текущий `task.number`, иначе `allocate(targetProjectId)` (порт через `TaskModule` экспорт или `ProjectTaskService` получает `TaskNumberPort` — тот же биндинг).
- **1.9** `shared/database/task-number-migration.service.ts` (create) + регистрация в `app.module.ts` — backfill по `createdAt`, идемпотентно, сдвиг счётчика.
- **1.10** Списки сущностей не меняются (новых сущностей нет).
- Commit: `feat(task): per-project task numbers and project key prefix`

### Phase 2 — фронт

- **2.1** `features/projects/model/types.ts` — `Project.taskKeyPrefix: string | null`, payloads `taskKeyPrefix?`; `features/tasks/model/types.ts` — `Task.number?: number | null`.
- **2.2** `features/projects/lib/task-key.ts` (create, TDD) — `taskKey(project: Pick<Project, 'type' | 'taskKeyPrefix'> | undefined, task: Pick<Task, 'number'>): string | null` — ключ только у agile с префиксом и номером.
- **2.3** `ProjectEditDialog.vue`, `ProjectCreateDialog.vue` — поле «Префикс задач» для agile (ввод приводится к верхнему регистру, подсказка «2–10 латинских букв и цифр, с буквы», ошибка сервера в диалоге; пустое → `null`).
- **2.4** Показ ключа: `TaskCard.vue` (перед названием, когда `taskKey` не `null`; проект из `projectStore.projectMap`), `BacklogTaskRow.vue`, `ReleaseRow.vue` (строки задач), `TaskDetailDialog.vue` (шапка после крошек). Стиль: `text-[11px] font-mono text-muted-foreground`.
- Commit: `feat(projects): task key prefix in project settings, keys on tasks`

### Test strategy

- `project.service.spec.ts`: префикс у agile — ок; у обычного — 400; неверный формат — 400 (e2e, DTO); дубликат у другого проекта пользователя — 400; у разных пользователей одинаковый — ок; очистка `null` — ок.
- `typeorm-task-number.adapter` на реальном SQLite: подряд 1, 2, 3; для обычного проекта `null`; счётчик не откатывается после удаления задачи.
- `task.service.spec.ts`: `create` в agile получает номер, в обычном — `null`; экземпляры повторяющейся задачи — свои номера; смена проекта — новый номер (в не-agile — `null`).
- `overdue-recurring.service.spec.ts`: преемник получает номер.
- `project-task.service.spec.ts`: `moveTask` внутри проекта сохраняет номер, в другой — новый.
- `task-number-migration.service.spec.ts` на SQLite: номера по `createdAt`, счётчик сдвинут, повторный запуск ничего не меняет, задачи обычных проектов не трогает.
- e2e: создание agile-проекта с префиксом → задачи получают номера 1, 2; дубликат префикса → 400; префикс у обычного → 400.
- Фронт: `task-key.spec.ts`; `ProjectEditDialog.spec.ts` — поле только у agile, верхний регистр, ошибка сервера; `TaskCard.spec.ts` — ключ у agile с префиксом, нет у обычного; живой браузер — ключи на доске, в бэклоге, в диалоге, смена префикса.

## Verify

**Result:** passed

Positive:
- backfill на dev-базе: 13 задач «Alfy 2.0» получили номера 1–13 по дате создания, счётчик 14; у задач обычного проекта `number = null`
- новая задача в agile-проекте → 14; переезд в другой agile-проект → номер 1 в новом проекте
- UI: поле «Префикс задач» в настройках agile-проекта, ввод `alf` → `ALF`; после сохранения ключи `ALF-N` сразу у всех задач бэклога; ключ `OTH-1` в строке бэклога и в шапке диалога задачи

Negative:
- дубль префикса у другого проекта пользователя → 400 «Task key prefix is already used»; префикс у обычного проекта → 400; формат `1AB` → 400

Invariants:
- номер в проекте не повторяется — уникальный индекс + атомарная выдача (10 параллельных `allocate` → 1..10 без повторов)
- удаление проекта обнуляет номера его задач (`c9d1e28`, тест на SQLite)

Smoke: бэк :3102 на dev-базе, фронт :5173; тестовые проекты удалены, префикс `ALF` у «Alfy 2.0» оставлен. Наборы: бэк 652 unit + 79 e2e, фронт 825; `tsc`, `vue-tsc` чистые.

Notes:
- При проверке всплыл дефект вёрстки строк бэклога из задачи спринтов: бейдж колонки и «⋯» переносились на вторую строку (с ключом стало заметнее). Исправлено: строка не переносится, метка эпика сжимается раньше названия (`dc3c4f9`).

## Conclusion
<empty — filled by up:ureview>

### Hands-off decisions
- make: полный цикл, ветка `feat/agile-board` (решение пользователя для agile-этапов).
- udesign: префикс не обязателен и существующим проектам не проставляется — генерировать его из названия было бы выдуманным значением; пока префикса нет, номер выдаётся, но ключ не показывается.
- udesign: префикс уникален среди проектов пользователя — иначе ключ `ALF-12` неоднозначен.
- udesign: формат `^[A-Z][A-Z0-9]{1,9}$` (как в Jira: латиница, с буквы).
- udesign: номера не переиспользуются после удаления — как в Jira, ключ не может вдруг указать на другую задачу.
- udesign: экземпляры повторяющейся задачи в agile-проекте получают собственные номера — это разные задачи.
- udesign: поиск по ключу и ключи в MCP/боте — вне скоупа.
- uplan: plan auto-approved (hands-off).
- uexecute: удаление проекта обнуляет номера его задач — иначе задачи во Входящих оставались с номером (замечание исполнителя фазы 1, `c9d1e28`).
- uverify: исправлен перенос строк в бэклоге (`dc3c4f9`) — дефект вёрстки задачи спринтов, стал заметен с ключами.

### Deferred (needs user input)
