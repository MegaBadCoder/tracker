# Agile-доска: эпики и истории (этап 1 — отображение)

**Status:** executing
**Branch:** feat/agile-board
**Worktree:** .worktrees/feat-agile-board
**Mode:** interactive

## Design

Спроектировано на Miro-борде [uXjVNAsstT8](https://miro.com/app/board/uXjVNAsstT8=). Артефакты:

- [Док «Решения и этапы»](https://miro.com/app/board/uXjVNAsstT8=/?moveToWidget=3458764681138724721) — источник истины по решениям
- [Макет v2 — десктоп](https://miro.com/app/board/uXjVNAsstT8=/?moveToWidget=3458764681139606182)
- [Макет — мобилка 390px](https://miro.com/app/board/uXjVNAsstT8=/?moveToWidget=3458764681139606183)
- [ERD v2](https://miro.com/app/board/uXjVNAsstT8=/?moveToWidget=3458764681140262185)

Design закрыт и переспрашиванию не подлежит. Ниже — самодостаточный пересказ, чтобы работать по файлу без доступа к борду.

### Зачем

На доске проекта сегодня есть только колонки-статусы: задачи лежат плоским списком внутри колонки. Нет способа увидеть, что задача принадлежит крупному куску работы. Нужна группировка «эпик → история → задачи» на **одной** доске, вместе со статусами, а не на отдельном экране.

### Решение 1 — эпик и история это новая сущность `BoardGroup`

Self-nesting внутри проекта: `parentId = null` → эпик, `parentId = <эпик>` → история. Ровно два уровня. Задача получает nullable `groupId`.

Почему не переиспользовать дерево проектов (`Project.parentId` уже есть, стоило бы ноль изменений схемы): эпики и истории полезли бы в сайдбар-навигацию, а создание истории стало бы созданием проекта — с иконкой, цветом и своим `viewMode`. Навигация и структура работы это разные вещи.

Почему не `parentId` + `type` на `Task` (как в Jira): два псевдо-типа задач протекли бы во все существующие списки — Inbox, Сегодня, календарь, таймер, поиск, повторяющиеся задачи. В каждый пришлось бы вставлять фильтр, и каждый новый экран был бы обязан про него помнить. Цена размазана по всему фронту и никогда не заканчивается.

Отдельная сущность локализует цену: задачи остаются задачами везде, проекты остаются навигацией, группировка существует только на Agile-доске.

### Решение 2 — колонки задаёт проект, эпик и история их не заводят

Три оси:

- **X — статус.** `ProjectColumn`, уже существует, не меняем.
- **Y — группировка.** `BoardGroup` как вложенные рамки.
- **Z — фокус.** Спринт. Этап 2, вне скоупа. Не строка и не колонка, а фильтр всей доски (`Task.sprintId`) — поэтому ляжет сверху, не трогая X и Y.

Заголовки колонок рендерятся **один раз на всю доску**. Эпик и история — вложенные рамки *поверх* сквозной колоночной сетки, а не собственные мини-доски. Смысл: вертикаль «В работе» не прерывается ни эпиком, ни историей, поэтому видно всю работу в статусе по всему проекту сразу.

Отклонённый вариант (v1 на борде): подпись строки в левом gutter ~200px. На 390px это половина экрана под подписи.

### Решение 3 — раскладка на CSS subgrid, скролл-контейнер один

Колоночная сетка живёт на корне доски. Вложенные рамки наследуют её через `grid-template-columns: subgrid`. Это то, что гарантирует выравнивание ячеек на любой глубине без ручного пересчёта ширин.

Рамки рисуются в запасе между краем колонки и карточкой (~22px), поэтому карточка не сдвигается ни на пиксель независимо от вложенности.

**Мобилка 390px:** колонка ~260px, видно полторы. Горизонтальный скролл-контейнер **ровно один, на всю доску**. Если дать скролл каждой истории отдельно — истории разъедутся по горизонтали и сквозные колонки перестанут быть сквозными, то есть сломается ровно то, ради чего всё делалось. Заголовки колонок — `position: sticky` по верху.

### Решение 4 — закрытие эпика только вручную

Эпик закрывает человек; на закрытых эпиках позже будут собираться релизы. Автоматического «все дети готовы → эпик готов» нет: прогресс показываем, закрыть может только явное действие.

Отсюда у `BoardGroup` собственное состояние `status: 'open' | 'done'` + `completedAt`. Это **не** то же самое, что «все задачи выполнены», и хранится отдельно.

Роли и сущность `Release` из формулировки «принимается менеджером» — не в этом этапе. В Alfy сегодня один пользователь; закрывающий это владелец проекта.

### Решение 5 — у задач в agile-проекте блок целей скрыт

`goalIds` у задачи остаётся в модели, но в `TaskDetailDialog` блок целей не показывается, когда проект в режиме `agile`.

Тонкость, зафиксированная сознательно: признак «agile-задача» сейчас выразим только через `viewMode` проекта, а `viewMode` это настройка отображения — её переключают туда-сюда. Получается, что смена режима просмотра меняет поведение UI. Поэтому вариант выбран мягкий: **скрываем в UI, ничего не удаляем и не запрещаем на бэке**. Уже проставленные `goalIds` остаются целыми, переключение режима полностью обратимо. Явный флаг проекта (`type: 'simple' | 'agile'`) честнее, но это отдельное решение — см. «Осталось открытым».

### Решение 6 — дефолтные колонки для agile-проекта

Обнаружено при разборе кода: **дефолтных колонок в проекте не создаётся вообще**, `ProjectColumn` заводит только пользователь руками. Значит решение «первая колонка называется *К выполнению*, а слово *Бэклог* зарезервировано за спринтовым измерением» не к чему прицепить — переименовывать нечего.

Поэтому: при создании проекта с `viewMode: 'agile'` (и при переключении на `agile`, если колонок ещё нет) засеваем три колонки — **К выполнению / В работе / Готово**. Даёт сразу рабочую доску и закрепляет договорённость про имена.

Слово «Бэклог» как имя колонки не используем: на этапе 2 бэклог станет отдельным экраном со списком задач без спринта, и колонка с тем же именем породила бы задачу «в колонке Бэклог, но внутри активного спринта».

### Модель

```
BoardGroup (новая таблица board_groups)
  id           uuid PK
  userId       int
  projectId    uuid FK -> projects, CASCADE
  parentId     uuid FK -> board_groups, nullable, CASCADE
  type         'epic' | 'story'
  title        string
  description  text | null
  status       'open' | 'done'   default 'open'
  completedAt  datetime | null
  color        text | null
  order        int
  createdAt / updatedAt

Task
  + groupId    uuid FK -> board_groups, nullable, SET NULL

Project
  viewMode: 'list' | 'board' | 'agile'   (было 'list' | 'board')
```

### Политика базы — защита в три уровня

Все три уровня обязательны, ни один в одиночку не закрывает задачу.

**1. CHECK-констрейнты** через `@Check(...)` на сущности, `synchronize: true` создаёт их сам:

- `type IN ('epic','story')`
- `status IN ('open','done')`
- `parentId <> id`
- `(parentId IS NULL AND type = 'epic') OR (parentId IS NOT NULL AND type = 'story')`

**2. Триггеры SQLite.** Главное правило — «родитель обязан быть эпиком» — CHECK-ом невыразимо: нужен подзапрос к строке родителя, а SQLite подзапросы в CHECK запрещает. Значит `BEFORE INSERT` и `BEFORE UPDATE` с `RAISE(ABORT, ...)`:

- если у вставляемой/обновляемой группы `parentId` не NULL, у родителя `parentId` обязан быть NULL — иначе появляется третий уровень;
- группе, у которой уже есть дети, нельзя проставить `parentId` — иначе эпик с историями задним числом превращается в историю, и третий уровень появляется с другой стороны;
- `task.groupId` обязан указывать на группу того же проекта, что `task.projectId`.

**3. Валидация в сервисе** — не вместо триггеров, а вместе: триггер отдаёт сырую ошибку SQLite, и без сервисной проверки клиент получит 500 вместо внятного 400.

**Ловушка, из-за которой это не разовая работа.** Триггеры не описываются декораторами TypeORM, `synchronize` их не создаёт. Хуже: при изменении схемы SQLite пересоздаёт таблицу (rename → create → copy → drop) и **молча роняет все триггеры на ней**. Поэтому `CREATE TRIGGER IF NOT EXISTS` должен выполняться на каждом старте приложения после synchronize — идемпотентным `BoardGroupConstraintsMigrationService` в `shared/database/`, рядом с остальными миграционными сервисами. Иначе защита однажды исчезнет при правке соседнего поля, и никто не заметит.

### Скоуп этапа 1

Входит:

- сущность `BoardGroup` + CRUD + триггеры + `Task.groupId`
- `viewMode: 'agile'` + засев дефолтных колонок
- `AgileBoardView` — отображение вложенности на сквозной колоночной сетке, десктоп и мобилка
- перетаскивание задач между ячейками (меняет `columnId` + `groupId` + `order`)
- создание/переименование/удаление эпиков и историй, ручное закрытие эпика
- скрытие блока целей в agile-проекте

Не входит (этап 2, только не мешать):

- `Sprint`, `Task.sprintId`, экран бэклога, фильтр по спринту
- хлебные крошки «Проект › Эпик › История» в диалоге задачи — но `groupId` обязан приходить в обычной выдаче задач, чтобы потом это не потребовало отдельного запроса
- роли, `Release`
- третий уровень вложенности

### Осталось открытым

- Признак «agile-проект»: остаётся `viewMode` или заводится явный флаг проекта.
- Третий уровень вложенности — если когда-нибудь понадобится.

### Invariants

- Глубина ровно 2. Эпик нельзя прикрепить к истории — ни через API, ни в обход сервиса, напрямую в репозиторий.
- Группе с детьми нельзя проставить `parentId`.
- `parentId <> id`.
- `parentId IS NULL` тогда и только тогда, когда `type = 'epic'`.
- `group.projectId` и `task.projectId` совпадают. Перенос задачи в другой проект обнуляет `groupId`.
- Удаление эпика каскадит на его истории, но **не удаляет задачи** — им ставится `groupId = null`, они падают в блок «Без эпика».
- Задача без `groupId` — нормальное состояние, а не ошибка. Доска обязана показывать проект, в котором нет ни одного эпика.
- `status = 'done'` у эпика ставится только явным действием и не выводится из состояния детей.
- Заголовки колонок рендерятся один раз на доску; горизонтальный скролл-контейнер на доске ровно один.
- Существующие гварды `viewMode === 'list'` в `project-column.service.ts` и `project-task.service.ts` остаются рабочими: `agile` проходит их так же, как `board`.

### Principles

- Группировка не протекает за пределы Agile-доски: ни бейджей в списках, ни в календаре, ни в таймере.
- `viewMode` управляет только отображением. Ни одно необратимое доменное действие не завязывается на него.
- Ячейка это пересечение колонки и группы, а не самостоятельная сущность. В БД её нет.
- Схема готовится под спринты, но ничего спринтового в этапе 1 не появляется.

### TDD

**Да** — для бэкенда и чистых утилит. Констрейнты, триггеры, правила глубины и раскладка задач по ячейкам детерминированы, а регрессия здесь означает молча испорченные данные. Тест на потерю триггеров при пересоздании таблицы обязателен и обязан бить **напрямую в репозиторий, мимо сервиса**, иначе он проверяет сервисную валидацию, а не защиту БД.

Компонентные тесты Vue — после реализации, по образцу существующих в `alfy-bot-frontend/tests/`.

## Plan

Approach: `BoardGroup` заводится как второй столп внутри существующего `ProjectModule` — зеркало `project-column.*` по всем четырём слоям, потому что у групп та же форма жизни (принадлежат проекту, упорядочены, CRUD под `projects/:projectId/...`). Бэкенд идёт снизу вверх: сущность → защита в БД → API → интеграция в существующие потоки. Фронт следом: данные → рендер → взаимодействие.

**Поправка к вводной.** Перетаскивание на доске идёт не через `PATCH /tasks/:id`, а через `PATCH /projects/:projectId/tasks/:taskId/move` — см. `use-board-dnd.ts:17` → `task-store.moveTask` → `ProjectTaskService.moveTask`. Поэтому `groupId` протаскивается через `MoveTaskDto` и `TaskRepositoryPort.updatePosition`, а `applyUpdateResponse` здесь ни при чём.

### Phase 1 — сущность, порт, репозиторий

- **1.1** `alfy-bot/src/shared/entities/board-group.entity.ts` (create)
  - `@Entity('board_groups') class BoardGroup` — поля по разделу «Модель» Design.
  - `@Check('CHK_board_group_type', "type IN ('epic','story')")`, `@Check('CHK_board_group_status', "status IN ('open','done')")`, `@Check('CHK_board_group_not_self', 'parentId <> id')`, `@Check('CHK_board_group_depth', "(parentId IS NULL AND type = 'epic') OR (parentId IS NOT NULL AND type = 'story')")`.
  - `@ManyToOne(() => BoardGroup)` на `parentId`, `onDelete: 'CASCADE'`; `@ManyToOne(() => Project)`, `onDelete: 'CASCADE'`.
  - Invariants: `parentId <> id`; согласованность `parentId` и `type`.
- **1.2** `alfy-bot/src/shared/entities/index.ts:13-15` (modify) — `export { BoardGroup } from './board-group.entity'`.
- **1.3** `alfy-bot/src/shared/entities/task.entity.ts:60,103-107` (modify)
  - `groupId: string | null` рядом с `columnId`; `@ManyToOne(() => BoardGroup, { nullable: true, onDelete: 'SET NULL' })`.
  - Invariant: удаление эпика не удаляет задачи — им ставится `groupId = null`.
- **1.4** `alfy-bot/src/app.module.ts:20-35,59-74` (modify) — `BoardGroup` в импорт и в `entities`.
- **1.5** `alfy-bot/src/modules/project/domain/board-group-repository.port.ts` (create)
  - `findAllByProject(projectId: string): Promise<BoardGroup[]>` — плоский список, дерево собирает сервис.
  - `findById(id: string, projectId: string): Promise<BoardGroup | null>`
  - `countChildren(id: string): Promise<number>`
  - `create(data: Partial<BoardGroup>): Promise<BoardGroup>` / `save` / `delete` / `reorder(updates: { id: string; order: number }[])`
- **1.6** `alfy-bot/src/modules/project/infrastructure/typeorm-board-group.repository.ts` (create) — зеркало `typeorm-project-column.repository.ts:16-47`.
- Commit: `feat(project): add BoardGroup entity and repository`

### Phase 2 — защита в БД (TDD, тесты первыми)

- **2.1** `alfy-bot/src/shared/database/board-group-constraints.service.ts` (create)
  - `class BoardGroupConstraintsMigrationService implements OnApplicationBootstrap` — по образцу `schedule-migration.service.ts:1-10`, инжектит `DataSource`.
  - `onApplicationBootstrap()` → `CREATE TRIGGER IF NOT EXISTS` ×5, идемпотентно, на каждом старте.
  - Триггеры: `trg_board_group_parent_must_be_epic` (BEFORE INSERT / BEFORE UPDATE), `trg_board_group_no_reparent_with_children` (BEFORE UPDATE), `trg_task_group_same_project` (BEFORE INSERT / BEFORE UPDATE на `tasks`).
  - Invariants: глубина ровно 2; группе с детьми нельзя проставить `parentId`; `group.projectId` = `task.projectId`.
- **2.2** `alfy-bot/src/app.module.ts:36-39,90-96` (modify) — импорт и провайдер.
- Ключевой фрагмент — правило, которое CHECK-ом невыразимо:
  ```sql
  CREATE TRIGGER IF NOT EXISTS trg_board_group_parent_must_be_epic
  BEFORE INSERT ON board_groups
  WHEN NEW.parentId IS NOT NULL
  BEGIN
    SELECT RAISE(ABORT, 'board_group: parent must be an epic')
    WHERE (SELECT parentId FROM board_groups WHERE id = NEW.parentId) IS NOT NULL;
  END;
  ```
- Commit: `feat(project): enforce BoardGroup depth with SQLite triggers`

### Phase 3 — CRUD групп

- **3.1** `alfy-bot/src/modules/project/dto/create-group.dto.ts`, `update-group.dto.ts` (create) — `title`, `parentId?`, `description?`, `color?`; update дополнительно `status?: 'open' | 'done'`.
- **3.2** `alfy-bot/src/modules/project/board-group.service.ts` (create)
  - `validateProjectAccess` — копия `project-column.service.ts:20-27`.
  - `getTree(userId, projectId): Promise<BoardGroupNode[]>` — плоский список из репозитория в дерево эпиков с `children`.
  - `create(userId, projectId, dto)` — если `parentId` задан, родитель обязан существовать, лежать в этом же проекте и иметь `parentId === null`; иначе `BadRequestException`. `type` выводится из `parentId`, клиент его не присылает.
  - `update(userId, projectId, id, dto)` — при смене `parentId` проверяет `countChildren(id) === 0`; при `status: 'done'` ставит `completedAt = new Date()`, при `'open'` — `null`.
  - `delete`, `reorder` — как у колонок.
  - Invariants: `status` меняется только явным действием и не выводится из детей.
- **3.3** `alfy-bot/src/modules/project/board-group.controller.ts` (create) — `@Controller('projects/:projectId/groups')`, порядок роутов как в `project-column.controller.ts:31-79`: `@Patch('reorder')` **до** `@Patch(':id')`.
- **3.4** `alfy-bot/src/modules/project/project.module.ts:19,23-37` (modify) — `BoardGroup` в `forFeature`, контроллер, биндинг порта, сервис.
- Commit: `feat(project): CRUD for epics and stories`

### Phase 4 — viewMode 'agile', засев колонок, groupId в move

- **4.1** `alfy-bot/src/shared/entities/project.entity.ts:32` (modify) — `viewMode: 'list' | 'board' | 'agile'`.
- **4.2** `alfy-bot/src/modules/project/dto/create-project.dto.ts:19-22`, `update-project.dto.ts:19-22` (modify) — `@IsIn(['list','board','agile'])` + тип.
- **4.3** `alfy-bot/src/modules/project/project.service.ts:14,37-46,48-71` (modify)
  - Конструктор получает `ProjectColumnRepositoryPort`.
  - `create` — после создания проекта с `viewMode === 'agile'` засевает `К выполнению / В работе / Готово` с `order` 0/1/2.
  - `update` — при переходе на `'agile'` засевает те же три, только если у проекта колонок ещё нет.
  - `private async seedAgileColumns(projectId: string): Promise<void>`
- **4.4** `alfy-bot/src/modules/project/dto/move-task.dto.ts:10-19` (modify) — `groupId?: string | null`.
- **4.5** `alfy-bot/src/modules/project/project-task.service.ts:18,47-99` (modify)
  - Инжектит `BoardGroupRepositoryPort`; `targetGroupId` разбирается как `targetColumnId` на строке 49.
  - Если `targetGroupId` задан — группа обязана существовать в `targetProjectId`, иначе `NotFoundException`.
  - Строки 69 и 76 (`viewMode === 'list'`) **не трогаем**: `agile` проходит их так же, как `board`.
- **4.6** `alfy-bot/src/modules/task/task.service.ts` (modify) — в `update`: если `projectId` меняется, `groupId` обнуляется в той же записи.
  - Иначе триггер `trg_task_group_same_project` отклонит апдейт и клиент получит 500 вместо переноса. Путь реальный: задачу можно перенести в другой проект через `PATCH /tasks/:id`, минуя `moveTask`.
  - Invariant: перенос задачи в другой проект обнуляет `groupId`.
- **4.7** `alfy-bot/src/modules/task/domain/task-repository.port.ts:35-41` + `infrastructure/typeorm-task.repository.ts:118-131` (modify) — `updatePosition` получает `groupId: string | null` после `columnId`.
  - Единственный продовый вызов — `project-task.service.ts:93`. Ломаются пять ассертов в `project-task.service.spec.ts:143,161,181,203,221` и мок в `overdue-recurring.service.spec.ts:62` — обновить.
- Commit: `feat(project): agile view mode, default columns, group in task move`

### Phase 5 — фронт: данные и рендер

- **5.1** `alfy-bot-frontend/src/features/projects/model/types.ts:1,3-11` (modify) — `ViewMode` + `'agile'`; интерфейсы `BoardGroup`, `BoardGroupNode`, payload-типы.
- **5.2** `alfy-bot-frontend/src/features/projects/api/groups-api.ts` (create) — зеркало `columns-api.ts:14-27` на `/projects/:id/groups`.
- **5.3** `alfy-bot-frontend/src/features/projects/model/group-store.ts` (create) — по образцу `column-store.ts`: `groups`, `loading`, `fetchGroups`, `createGroup`, `updateGroup`, `deleteGroup`, `reorderGroups`, `toggleEpicDone`.
- **5.4** `alfy-bot-frontend/src/features/projects/lib/agile-layout.ts` (create) — чистая функция раскладки, тестируется без DOM.
  - `buildAgileRows(groups: BoardGroupNode[], tasks: Task[]): AgileRow[]` — эпики по порядку, внутри истории, затем «задачи эпика без истории», в конце всегда «Без эпика».
  - Invariants: задача без `groupId` — норма; проект без эпиков рендерится.
- **5.5** `AgileBoardView.vue`, `AgileEpicBlock.vue`, `AgileStoryBlock.vue`, `AgileCell.vue` (create, `features/projects/ui/`)
  - `AgileBoardView` владеет колоночной сеткой и **единственным** `overflow-x-auto`; вложенные блоки — `grid-template-columns: subgrid`. Заголовки колонок — `sticky top-0`, рендерятся один раз.
  - Invariants: заголовки один раз на доску; скролл-контейнер ровно один.
- **5.6** `ViewModeToggle.vue:14-25` (modify) — третья кнопка `agile`, иконка `Rows3`.
- **5.7** `alfy-bot-frontend/src/views/ProjectView.vue:31,98,189` (modify) — `isAgileMode`, ветка рендера, `handleViewModeChange` расширяет каст типа.
- Commit: `feat(projects): agile board view with nested epics and stories`

### Phase 6 — DnD, скрытие целей, компонентные тесты

- **6.1** `alfy-bot-frontend/src/features/projects/lib/use-agile-dnd.ts` (create) — по образцу `use-board-dnd.ts:13-25`, но передаёт `groupId` ячейки в `moveTask`.
- **6.2** `alfy-bot-frontend/src/features/tasks/model/task-store.ts:289` (modify) — `moveTask` payload получает `groupId?: string | null`.
- **6.3** Все `AgileCell` получают общий `:group="{ name: 'agile-tasks' }"` — иначе перетаскивание между эпиками не работает.
- **6.4** `alfy-bot-frontend/src/features/tasks/ui/TaskDetailDialog.vue:166,260,489-490,624` (modify) — блок целей и его drawer скрываются, когда проект задачи в режиме `agile`. Ничего не удаляется и не отправляется на бэк.
  - Invariant: `viewMode` управляет только отображением; действие обратимо.
- Commit: `feat(projects): agile drag-and-drop, hide goals in agile projects`

### Test strategy

TDD (тесты первыми) — фазы 1-4:

- `board-group-constraints.service.spec.ts` — на реальном SQLite in-memory `DataSource`, запись **напрямую через репозиторий, мимо сервиса**:
  - вставка группы с `parentId`, указывающим на историю → отклонена;
  - проставление `parentId` группе, у которой есть дети → отклонено;
  - `parentId = id` → отклонено;
  - `type = 'epic'` при непустом `parentId` → отклонено;
  - `task.groupId` из чужого проекта → отклонено;
  - **пересоздание таблицы** (`ALTER TABLE ... RENAME` + `CREATE` + повторный вызов `onApplicationBootstrap`) → защита снова работает. Это тест на ту самую ловушку `synchronize`.
- `board-group.service.spec.ts` — попытка вложить в историю отдаёт 400, а не 500; удаление эпика каскадит на истории и обнуляет `groupId` у задач; `status: 'done'` проставляет `completedAt`, `'open'` — обнуляет.
- `project.service.spec.ts` — создание `agile`-проекта засевает три колонки с ожидаемыми именами; `list` и `board` не засевают ничего; переключение на `agile` при уже существующих колонках не засевает.
- `project-column.service.spec.ts` — `viewMode: 'agile'` проходит гвард строки 44 (колонку создать можно).
- `project-task.service.spec.ts` — `move` с `groupId` чужого проекта → 404; с валидным → `updatePosition` получает `groupId`.
- `task.service.spec.ts` — смена `projectId` через `PATCH /tasks/:id` обнуляет `groupId` (иначе триггер отдаёт 500).

После реализации — фронт:

- `agile-layout.spec.ts` — порядок строк; задачи без `groupId` попадают в «Без эпика»; проект без групп рендерится одной строкой.
- `AgileBoardView.spec.ts` — заголовки колонок отрисованы ровно один раз; горизонтальный скролл-контейнер ровно один (защита инварианта из Design); задача рендерится в ячейке на пересечении своей колонки и своей группы.
- `TaskDetailDialog.spec.ts` — блок целей отсутствует при `viewMode: 'agile'` и присутствует при `board`.

### Order & dependencies

1 → 2 → 3 → 4 последовательны. 5 зависит от 3 и 4 (нужны API и `groupId` в задаче). 6 зависит от 5.

### Open questions / risks / rollback

- **`subgrid`.** Поддержка Chrome 117+, Safari 16+, Firefox 71+ — для PWA приемлемо. Риск невелик: ширины колонок фиксированы в px, поэтому при отсутствии `subgrid` вложенные блоки могут повторить `repeat(N, var(--col-w))` и выровняются так же. Фолбэк не пишем заранее, но он однострочный.
- **Совместимость.** `Task.groupId` — новая nullable-колонка, `synchronize` добавит её, существующие строки получат `null`. CHECK-констрейнты ставятся только на новую таблицу, где нарушать нечего. Расширение `viewMode` обратно совместимо: существующие проекты остаются `list`/`board`. Смена сигнатуры `updatePosition` — внутренняя, единственный продовый вызов правится в той же фазе.
- **Триггеры против `synchronize`.** Главный риск задачи: при любом будущем изменении схемы `board_groups` или `tasks` SQLite пересоздаст таблицу и уронит триггеры. Митигация — фаза 2 (пересоздание на каждом старте) плюс тест на пересоздание таблицы. Без этого теста защита деградирует молча.
- **Rollback.** Фича аддитивная: пока пользователь не переключил проект в `agile`, ничего из этого не исполняется. Откат — убрать третью кнопку из `ViewModeToggle`.

## Verify

**Result:** passed (после одного провала и починки)

Positive:
- `POST /projects {viewMode:'agile'}` → 201, `GET .../columns` отдаёт `К выполнению | В работе | Готово` в порядке 0/1/2
- `POST .../groups {title}` → 201, `type: 'epic'`, `parentId: null`
- `POST .../groups {title, parentId: <эпик>}` → 201, `type: 'story'`
- `GET .../groups` → дерево: эпик с вложенной историей
- `PATCH .../tasks/:id/move {columnId, groupId}` → задача получает оба поля одним запросом
- `PATCH .../groups/:id {status:'done'}` → `completedAt` проставлен, `'open'` → обнулён

Negative:
- третий уровень (`parentId` = история) → **400**, не 500
- группа родитель самой себе → **400**
- `move` с `groupId` чужого проекта → 404

Invariants (записью напрямую в SQLite, мимо приложения):
- группа под историю → `board_group: parent must be an epic`
- эпик с детьми превратить в историю → `cannot reparent a group that has children`
- `task.groupId` из чужого проекта → `task: group must belong to the same project as the task`
- данные после всех четырёх попыток целы
- в живой БД стоят все 5 триггеров, лог старта: `board_groups/tasks constraint triggers ensured`
- `move` без `groupId` группу сохраняет; `move-to-inbox` обнуляет её и отдаёт 200

Smoke: живой бэкенд `PORT=3099 ENABLE_TELEGRAM=false npm run start:dev`, весь путь пройден curl-ом — от создания agile-проекта до переноса задачи во Входящие.

Notes: первый прогон **провалился** — `POST /projects/:id/groups` отдавал 500: `NOT NULL constraint failed: board_groups.userId`, сервис не проставлял `userId`. То есть создание любого эпика было сломано, а фича целиком нерабочей. 449 юнит-тестов этого не видели, потому что `board-group.service.spec.ts` мокает репозиторий и ограничения схемы там не проверяются в принципе. Починено в `5c6474c`; заодно заведён `test/board-groups.e2e-spec.ts` (11 тестов на реальном HTTP и реальной схеме) — откат той единственной строки красит этот сьют, проверено.

Отдельно: порт 3002 занят чужим инстансом (dev-сервер пользователя), проверка велась на 3099. Чужой процесс не затронут.

## Conclusion
<empty — filled by up:ureview>

### Deviations from plan

- Фаза 1 дополнительно правит два файла с собственными списками сущностей, которых в плане не было — `typeorm-report-answer.repository.spec.ts` и `test/helpers/test-app.ts`. Оба строят свой `DataSource`, и после появления связи `Task` → `BoardGroup` падали с `Entity metadata for Task#group was not found`. Проверено прямым сравнением: без правки `test-app.ts` e2e даёт именно эту ошибку, с правкой — уходит дальше.

- Вне плана: коммит `67f0e2a` чинит предсуществующую поломку e2e (все 3 сьюта / 32 теста падали уже на базовом `a93d0e5`). Сделано по явному решению пользователя, чтобы у `up:uverify` был интеграционный сигнал. Причины: SMTP-ключи не заданы в `setup-e2e-env.ts`; `TaskGoalQueryPort` не провайдился в `web-goal-reports-routing.e2e-spec.ts`; список сущностей в `test-app.ts` отстал от `app.module.ts`. После — 32/32 зелёные.

- Фаза 3: `order` считается в пределах братьев (эпики соревнуются между собой, истории — внутри своего эпика), а не глобально по проекту. План этого не уточнял; без этого `getTree` не смог бы отдать корректный порядок на обоих уровнях.
- Фаза 3: `UpdateGroupDto.parentId` остался ненулевым, поэтому историю нельзя разжаловать обратно в эпик через `parentId: null`. Design такого сценария не требует, перенос истории между эпиками работает.
- Фаза 3: реализатор сознательно не поставил проверку `parentId === id` в сервисе, положившись на CHECK в БД. Это нарушало бы Design — клиент получал бы 500 вместо 400 (подтверждено тестом: сервис возвращал группу с `parentId === id`, отказ приходил только из SQLite). Проверка добавлена диспетчером в тот же коммит, по образцу `project.service.ts:57-59`.
- Фаза 6: правка `TaskPropertyChips.vue` (нет в списке файлов фазы) — добавлен опциональный проп `hideGoals`. Компонент собирает список чипов внутри себя, механизма исключения не было, а без этого чип целей остался бы виден в agile-проекте.
- Фаза 6: `moveTask` трактовал отсутствующий `groupId` как «обнулить», а `use-board-dnd.ts:17` его не шлёт вообще. Значит переключение проекта в режим «Доска» плюс одно перетаскивание молча выкидывали задачу из эпика — необратимое доменное действие, завязанное на настройку отображения, что Design прямо запрещает. Починено отдельным коммитом `a869353`: отсутствие поля значит «не трогать», явный `null` — «убрать из группы», переезд в другой проект — обнулить (группа принадлежит старому проекту). Фикс вскрыл соседний случай: перенесённый `groupId` валидировался против целевого проекта и при переезде дал бы 404 вместо обнуления.
- Фаза 5: `groupId` добавлен во фронтовый тип `Task` (`features/tasks/model/types.ts`), в списке файлов фазы этого не было. Без него раскладка не типизируется, а с бэкенда поле и так приходит.
- Фаза 5: задачи с `columnId === null` не рендерились на доске вообще — все три компонента фильтровали через `if (task.columnId)`. В agile-проекте это массовый случай: задача, созданная обычным добавлением, колонки не получает и просто исчезала бы с доски. Починено отдельным коммитом по образцу `BoardView.vue:97-98`, который для таких задач держит отдельную дорожку.
- Фаза 4: план назвал только `TaskService.update` как путь, где смена проекта обязана обнулять `groupId`. Consistency-проход нашёл второй такой путь — `TaskService.moveToInbox` (`task.service.ts:594`), он обнулял `projectId` и `columnId`, но не `groupId`. Перенос сгруппированной задачи в Inbox упирался бы в `trg_task_group_same_project` и отдавал 500. Тест и фикс добавлены диспетчером в тот же коммит.
- Фаза 2 проверена мутацией, а не только своим спеком: безусловный `RAISE(ABORT)` в триггере на `tasks` роняет 22 e2e-теста, значит триггеры действительно живут в собранном приложении, а не только в изолированном `DataSource` юнит-спека. Побочная находка: мутация «отказывать когда `groupId` не совпадает с проектом» e2e не ломает — задачи в `tasks.e2e-spec.ts` создаются без проекта, поэтому кросс-проектный путь триггера покрыт только юнит-тестом.

### Known risks

- **Список сущностей в `test/helpers/test-app.ts` поддерживается руками и уже дважды разошёлся с `app.module.ts`** — на `Link`/`ApiToken`/`AuthMethod`/`PushSubscription` (до этой ветки) и на `BoardGroup` (в фазе 1). Каждый раз это ломает весь e2e-набор целиком и молча, потому что `npm test` его не запускает. Устойчивое лечение — общий экспорт `ALL_ENTITIES` из `shared/entities/index.ts`, используемый и в `app.module.ts`, и в тестах. Не сделано: выходит за скоуп задачи, требует правки `app.module.ts`.
